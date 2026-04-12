<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Symfony\Component\DomCrawler\Crawler;
use Throwable;

class UniversityScraperService
{
    private Client $client;

    private string $loginPath;

    /** @var array<int, string> */
    private array $profilePaths;

    /** @var array<int, string> */
    private array $coursesPaths;

    /** @var array<int, string> */
    private array $marksPaths;

    /** @var array<int, string> */
    private array $schedulePaths;

    private bool $debugMode = false;

    private bool $authenticated = false;

    public function __construct(?Client $client = null)
    {
        $baseUrl = rtrim((string) config('services.zu_portal.base_url', 'https://eservices.zu.edu.jo'), '/').'/';
        $verifyOption = $this->resolveSslVerifyOption();
        $this->debugMode = (bool) config('services.zu_portal.debug', false);

        $this->loginPath = (string) config('services.zu_portal.login_path', '/StudentPortal2/Login/loginPage');
        $this->profilePaths = $this->normalizePaths((array) config('services.zu_portal.profile_paths', [
            '/StudentPortal2/Home/HomePage',
            '/StudentPortal2/Home/UniversityDegree',
            '/StudentPortal2/Student/Profile',
            '/StudentPortal2/StudentPortal/profile',
            '/StudentPortal2/Student/Main/profile',
        ]));
        $this->marksPaths = $this->normalizePaths((array) config('services.zu_portal.marks_paths', [
            '/StudentPortal2/Marks/marks',
        ]));
        $this->schedulePaths = $this->normalizePaths((array) config('services.zu_portal.schedule_paths', [
            '/StudentPortal2/Home/stSchedule',
        ]));
        $this->coursesPaths = $this->normalizePaths((array) config('services.zu_portal.courses_paths', [
            '/StudentPortal2/Plans/studentPlan',
            '/StudentPortal2/Student/StudyPlan',
            '/StudentPortal2/Student/Courses',
            '/StudentPortal2/Student/Main/plan',
        ]));

        $this->client = $client ?? new Client([
            'base_uri' => $baseUrl,
            'cookies' => true,
            'verify' => $verifyOption,
            'http_errors' => false,
            'allow_redirects' => [
                'max' => 5,
                'strict' => false,
                'referer' => true,
            ],
            'timeout' => 25,
            'connect_timeout' => 10,
            'headers' => [
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
                'Accept-Language' => 'ar,en-US;q=0.9,en;q=0.8',
            ],
        ]);
    }

    /**
     * Resolve SSL verification strategy for portal requests.
     *
     * @return bool|string
     */
    private function resolveSslVerifyOption(): bool|string
    {
        $verifySsl = (bool) config('services.zu_portal.verify_ssl', true);
        if (!$verifySsl) {
            return false;
        }

        $caBundle = trim((string) config('services.zu_portal.ca_bundle', ''));

        if ($caBundle !== '' && is_file($caBundle) && is_readable($caBundle)) {
            return $caBundle;
        }

        return true;
    }

    /**
     * Authenticate against ZU student portal.
     */
    public function login($student_id, $password): void
    {
        $studentId = trim((string) $student_id);
        $studentPassword = (string) $password;

        if ($studentId === '' || $studentPassword === '') {
            throw new RuntimeException('Student ID and password are required.');
        }

        try {
            $loginPageUrl = $this->toAbsoluteUrl($this->loginPath);
            $loginHtml = $this->requestBody($this->loginPath);
            $crawler = new Crawler($loginHtml, $loginPageUrl);

            $form = $crawler->filter('form#PerLogin');
            if (!$form->count()) {
                $form = $crawler->filter('form')->first();
            }

            if (!$form->count()) {
                throw new RuntimeException('Unable to locate login form on the university portal.');
            }

            $actionRaw = trim((string) ($form->attr('action') ?? $this->loginPath));
            $actionUrl = $this->resolveUrl($actionRaw, $loginPageUrl);

            $payload = [
                'username' => $studentId,
                'password' => $studentPassword,
            ];

            foreach ($form->filter('input[type="hidden"][name]') as $input) {
                $name = trim((string) ($input->getAttribute('name') ?? ''));
                if ($name === '') {
                    continue;
                }

                $payload[$name] = (string) ($input->getAttribute('value') ?? '');
            }

            $response = $this->client->post($actionUrl, [
                'form_params' => $payload,
                'headers' => [
                    'Referer' => $loginPageUrl,
                    'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ],
            ]);

            $html = (string) $response->getBody();
            $this->assertLoginSucceeded($html);
            $this->authenticated = true;
        } catch (Throwable $exception) {
            throw new RuntimeException('Portal login failed: '.$exception->getMessage(), 0, $exception);
        }
    }

    /**
     * Scrape student profile data from the portal.
     *
     * @return array{name:?string, major:?string, gpa:?float, gpa_raw:?string}
     */
    public function getStudentData(): array
    {
        $this->ensureAuthenticated();

        [$html, $url] = $this->fetchFromCandidates($this->profilePaths, [
            'الاسم',
            'التخصص',
            'المعدل',
            'الدرجة',
            'الجامعة',
            'Student',
        ]);

        $crawler = new Crawler($html, $url);
        $pageText = $this->cleanText(strip_tags($html));

        $name = $this->extractFieldByLabels($crawler, ['اسم الطالب', 'الاسم', 'Student Name', 'Name'])
            ?? $this->extractFromSelectors($crawler, ['#studentName', '.student-name', '.name'])
            ?? $this->extractFieldByInlineLabel($crawler, ['اسم الطالب', 'Student Name', 'Name'])
            ?? $this->extractFromTextPatterns($pageText, [
                '/(?:اسم\s*الطالب(?:\s*الرباعي)?|Student\s*Name)\s*[:：\-]?\s*([^\|]{2,120})/iu',
            ]);

        $major = $this->extractFieldByLabels($crawler, ['التخصص', 'Major'])
            ?? $this->extractFromSelectors($crawler, ['#major', '.student-major', '.major'])
            ?? $this->extractFieldByInlineLabel($crawler, ['التخصص', 'البرنامج', 'Major', 'Program'])
            ?? $this->extractFromTextPatterns($pageText, [
                '/(?:التخصص|البرنامج|Major|Program)\s*[:：\-]?\s*([^\|]{2,120})/iu',
            ]);

        $gpaRaw = $this->extractFieldByLabels($crawler, ['المعدل التراكمي', 'المعدل', 'GPA', 'CGPA'])
            ?? $this->extractFromSelectors($crawler, ['#gpa', '.student-gpa', '.gpa'])
            ?? $this->extractFieldByInlineLabel($crawler, ['المعدل التراكمي', 'المعدل', 'GPA', 'CGPA'])
            ?? $this->extractFromTextPatterns($pageText, [
                '/(?:المعدل\s*التراكمي|المعدل\s*العام|المعدل|GPA|CGPA)\s*[:：\-]?\s*([0-9٠-٩\.,٫،]{1,8})/iu',
            ]);

        $name = $this->sanitizeExtractedField($name, 80);
        $major = $this->sanitizeExtractedField($major, 120);
        $gpaRaw = $this->sanitizeExtractedField($gpaRaw, 24);

        $gpa = $this->parseNumber($gpaRaw);
        if ($gpa !== null && $gpa > 100) {
            $gpa = null;
        }

        $this->logDebug('profile_extracted', [
            'source_url' => $url,
            'name' => $name,
            'major' => $major,
            'gpa_raw' => $gpaRaw,
            'gpa' => $gpa,
        ]);

        return [
            'name' => $name,
            'major' => $major,
            'gpa' => $gpa,
            'gpa_raw' => $gpaRaw,
        ];
    }

    /**
     * Scrape passed courses table from the portal.
     *
     * @return array<int, array{course_name:string, course_code:?string, grade:?float, grade_raw:?string, credits:?float}>
     */
    public function getCourses(?string $academicYear = null, ?string $academicTerm = null): array
    {
        $this->ensureAuthenticated();

        $normalizedYear = $this->cleanText($academicYear ?? '');
        $normalizedTerm = $this->normalizeAcademicTerm($academicTerm);

        $marksCourses = $this->extractCoursesFromCandidates(
            $this->marksPaths,
            ['العلامة', 'الدرجة', 'Marks', 'Grade', 'Result', 'المساق', 'المادة'],
            $normalizedYear,
            $normalizedTerm
        );

        $planCourses = $this->extractCoursesFromCandidates(
            $this->coursesPaths,
            ['المواد', 'الخطة', 'الخطة الدراسية', 'الساعات', 'Course', 'Plan'],
            $normalizedYear,
            $normalizedTerm
        );

        $scheduleCourses = $this->extractCoursesFromCandidates(
            $this->schedulePaths,
            ['الجدول', 'الشعبة', 'المساق', 'Schedule', 'Section', 'Time'],
            $normalizedYear,
            $normalizedTerm
        );

        $merged = $this->mergeCourses($marksCourses, $planCourses, $scheduleCourses);

        $this->logDebug('courses_merged', [
            'academic_year' => $normalizedYear,
            'academic_term' => $normalizedTerm,
            'marks_count' => count($marksCourses),
            'plan_count' => count($planCourses),
            'schedule_count' => count($scheduleCourses),
            'final_count' => count($merged),
            'sample' => array_slice($merged, 0, 8),
        ]);

        return $merged;
    }

    /**
     * @param array<int, string> $paths
     * @param array<int, string> $keywords
     * @return array{0:string,1:string}
     */
    private function fetchFromCandidates(
        array $paths,
        array $keywords = [],
        ?string $academicYear = null,
        ?string $academicTerm = null
    ): array
    {
        $bestHtml = null;
        $bestUrl = null;
        $bestScore = -1;

        $lastHtml = null;
        $lastUrl = null;

        foreach ($paths as $path) {
            $absolute = $this->toAbsoluteUrl($path);

            try {
                $html = $this->requestBody($path);

                if (filled($academicYear) || filled($academicTerm)) {
                    $html = $this->applyAcademicSelection($html, $absolute, $academicYear, $academicTerm);
                }

                $text = mb_strtolower($this->cleanText(strip_tags($html)));
                $score = 0;

                foreach ($keywords as $keyword) {
                    if (str_contains($text, mb_strtolower($keyword))) {
                        $score++;
                    }
                }

                $lastHtml = $html;
                $lastUrl = $absolute;

                if (empty($keywords)) {
                    $score = max($score, 1);
                }

                $score += $this->scoreAcademicContext($text, $academicYear, $academicTerm);

                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestHtml = $html;
                    $bestUrl = $absolute;
                }

                $this->logDebug('candidate_page_checked', [
                    'path' => $path,
                    'absolute' => $absolute,
                    'score' => $score,
                    'academic_year' => $academicYear,
                    'academic_term' => $academicTerm,
                ]);
            } catch (Throwable) {
                continue;
            }
        }

        if ($bestHtml !== null && $bestUrl !== null && $bestScore > 0) {
            return [$bestHtml, $bestUrl];
        }

        if ($lastHtml !== null && $lastUrl !== null) {
            return [$lastHtml, $lastUrl];
        }

        throw new RuntimeException('Unable to locate the target portal page after login.');
    }

    /**
     * @param array<int, string> $paths
     * @param array<int, string> $keywords
     * @return array<int, array{course_name:string, course_code:?string, grade:?float, grade_raw:?string, credits:?float}>
     */
    private function extractCoursesFromCandidates(
        array $paths,
        array $keywords,
        ?string $academicYear,
        ?string $academicTerm
    ): array {
        try {
            [$html, $url] = $this->fetchFromCandidates($paths, $keywords, $academicYear, $academicTerm);

            return $this->extractCoursesFromHtml($html, $url);
        } catch (Throwable $exception) {
            $this->logDebug('courses_source_failed', [
                'paths' => $paths,
                'message' => $exception->getMessage(),
            ]);

            return [];
        }
    }

    /**
     * @return array<int, array{course_name:string, course_code:?string, grade:?float, grade_raw:?string, credits:?float}>
     */
    private function extractCoursesFromHtml(string $html, string $url): array
    {
        $crawler = new Crawler($html, $url);
        $table = $this->detectCoursesTable($crawler);

        if (!$table) {
            return [];
        }

        $headerMap = $this->resolveHeaderMap($table);
        $rows = $table->filter('tbody tr');

        if (!$rows->count()) {
            $rows = $table->filter('tr');
        }

        $courses = [];

        foreach ($rows as $row) {
            $rowCrawler = new Crawler($row);
            $cells = $rowCrawler->filter('td');

            if (!$cells->count()) {
                continue;
            }

            $rowText = $this->cleanText($rowCrawler->text(''));
            if ($this->isSummaryText($rowText)) {
                continue;
            }

            $courseName = $this->extractCourseNameFromRow($cells, $headerMap);
            if (!$this->isLikelyCourseName($courseName)) {
                continue;
            }

            $courseCode = $this->extractLikelyCodeRaw($cells, $headerMap);
            $gradeRaw = $this->extractLikelyGradeRaw($cells, $headerMap);
            $creditsRaw = $this->extractLikelyCreditsRaw($cells, $headerMap);

            $courses[] = [
                'course_name' => $courseName,
                'course_code' => $courseCode !== '' ? $courseCode : null,
                'grade' => $this->parseNumber($gradeRaw),
                'grade_raw' => $gradeRaw !== '' ? $gradeRaw : null,
                'credits' => $this->parseNumber($creditsRaw),
            ];
        }

        $this->logDebug('courses_extracted', [
            'url' => $url,
            'headers' => $headerMap,
            'count' => count($courses),
            'sample' => array_slice($courses, 0, 6),
        ]);

        return $courses;
    }

    /**
     * @param array<int, array{course_name:string, course_code:?string, grade:?float, grade_raw:?string, credits:?float}> ...$courseSets
     * @return array<int, array{course_name:string, course_code:?string, grade:?float, grade_raw:?string, credits:?float}>
     */
    private function mergeCourses(array ...$courseSets): array
    {
        $merged = [];

        foreach ($courseSets as $courseSet) {
            foreach ($courseSet as $course) {
                $key = $this->courseIdentityKey($course);
                if ($key === null) {
                    continue;
                }

                if (!isset($merged[$key])) {
                    $merged[$key] = $course;
                    continue;
                }

                $current = $merged[$key];

                if (blank($current['course_code'] ?? null) && filled($course['course_code'] ?? null)) {
                    $current['course_code'] = $course['course_code'];
                }

                if (($current['grade'] ?? null) === null && ($course['grade'] ?? null) !== null) {
                    $current['grade'] = $course['grade'];
                    $current['grade_raw'] = $course['grade_raw'] ?? null;
                }

                if (($current['credits'] ?? null) === null && ($course['credits'] ?? null) !== null) {
                    $current['credits'] = $course['credits'];
                }

                if (mb_strlen((string) ($course['course_name'] ?? '')) > mb_strlen((string) ($current['course_name'] ?? ''))) {
                    $current['course_name'] = (string) $course['course_name'];
                }

                $merged[$key] = $current;
            }
        }

        return array_values($merged);
    }

    /**
     * @param array{course_name:string, course_code:?string, grade:?float, grade_raw:?string, credits:?float} $course
     */
    private function courseIdentityKey(array $course): ?string
    {
        $normalizedCode = $this->normalizeCourseCode($course['course_code'] ?? null);
        if ($normalizedCode !== '') {
            return 'code:'.$normalizedCode;
        }

        $normalizedName = $this->normalizeCourseNameKey((string) ($course['course_name'] ?? ''));
        if ($normalizedName !== '') {
            return 'name:'.$normalizedName;
        }

        return null;
    }

    private function normalizeCourseCode(?string $value): string
    {
        $clean = $this->toWesternDigits($this->cleanText($value));
        if ($clean === '') {
            return '';
        }

        $clean = mb_strtoupper($clean);
        $clean = preg_replace('/[^A-Z0-9]/', '', $clean) ?? '';

        return $clean;
    }

    private function normalizeCourseNameKey(string $value): string
    {
        $clean = mb_strtolower($this->cleanText($value));
        if ($clean === '') {
            return '';
        }

        $clean = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $clean) ?? '';
        $clean = preg_replace('/\s+/u', ' ', $clean) ?? '';

        return trim($clean);
    }

    private function normalizeAcademicTerm(?string $term): string
    {
        $clean = mb_strtolower($this->cleanText($term));
        if ($clean === '') {
            return '';
        }

        $numeric = $this->parseNumber($clean);
        if ($numeric !== null && in_array((int) round($numeric), [1, 2, 3], true)) {
            return (string) (int) round($numeric);
        }

        if ($this->containsAny($clean, ['اول', 'الأول', 'first', '1st'])) {
            return '1';
        }
        if ($this->containsAny($clean, ['ثاني', 'الثاني', 'second', '2nd'])) {
            return '2';
        }
        if ($this->containsAny($clean, ['صيف', 'summer', 'third', '3rd'])) {
            return '3';
        }

        return $clean;
    }

    private function scoreAcademicContext(string $pageText, ?string $academicYear, ?string $academicTerm): int
    {
        $score = 0;

        $normalizedText = mb_strtolower($this->toWesternDigits($pageText));

        $year = $this->cleanText($academicYear);
        if ($year !== '') {
            $yearDigits = preg_replace('/\D+/', '', $this->toWesternDigits($year)) ?? '';
            $textDigits = preg_replace('/\D+/', '', $normalizedText) ?? '';

            if ($yearDigits !== '' && str_contains($textDigits, $yearDigits)) {
                $score += 2;
            } elseif (str_contains($normalizedText, mb_strtolower($year))) {
                $score += 1;
            }
        }

        $term = $this->normalizeAcademicTerm($academicTerm);
        if ($term !== '' && $this->matchesAcademicTermInText($normalizedText, $term)) {
            $score += 2;
        }

        return $score;
    }

    private function matchesAcademicTermInText(string $pageText, string $term): bool
    {
        $tokens = $this->academicTermTokens($term);

        foreach ($tokens as $token) {
            if ($this->containsToken($pageText, mb_strtolower($token))) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<int, string>
     */
    private function academicTermTokens(string $term): array
    {
        return match ($term) {
            '1' => ['1', '01', 'اول', 'الأول', 'الفصل الاول', 'first', '1st'],
            '2' => ['2', '02', 'ثاني', 'الثاني', 'الفصل الثاني', 'second', '2nd'],
            '3' => ['3', '03', 'صيفي', 'فصل صيفي', 'summer', 'third', '3rd'],
            default => [$term],
        };
    }

    private function applyAcademicSelection(
        string $html,
        string $pageUrl,
        ?string $academicYear,
        ?string $academicTerm
    ): string {
        $year = $this->cleanText($academicYear);
        $term = $this->normalizeAcademicTerm($academicTerm);

        if ($year === '' && $term === '') {
            return $html;
        }

        try {
            $crawler = new Crawler($html, $pageUrl);

            foreach ($crawler->filter('form') as $formNode) {
                $form = new Crawler($formNode, $pageUrl);
                $selection = $this->buildAcademicSelectionPayload($form, $year, $term);

                if (!($selection['has_filters'] ?? false)) {
                    continue;
                }

                $fields = (array) ($selection['fields'] ?? []);
                $actionRaw = trim((string) ($form->attr('action') ?? $pageUrl));
                $actionUrl = $this->resolveUrl($actionRaw, $pageUrl);
                $method = strtoupper(trim((string) ($form->attr('method') ?? 'GET')));

                $options = [
                    'headers' => [
                        'Referer' => $pageUrl,
                        'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    ],
                ];

                if ($method === 'GET') {
                    $options['query'] = $fields;
                    $response = $this->client->get($actionUrl, $options);
                } else {
                    $options['form_params'] = $fields;
                    $response = $this->client->post($actionUrl, $options);
                }

                $status = $response->getStatusCode();
                if ($status >= 200 && $status < 400) {
                    $filteredHtml = (string) $response->getBody();
                    $this->logDebug('academic_selection_applied', [
                        'page' => $pageUrl,
                        'action' => $actionUrl,
                        'method' => $method,
                        'status' => $status,
                        'year_field' => $selection['year_field'] ?? null,
                        'term_field' => $selection['term_field'] ?? null,
                    ]);

                    return $filteredHtml;
                }
            }
        } catch (Throwable $exception) {
            $this->logDebug('academic_selection_failed', [
                'page' => $pageUrl,
                'message' => $exception->getMessage(),
            ]);
        }

        return $html;
    }

    /**
     * @return array{has_filters:bool,fields:array<string,string>,year_field:?string,term_field:?string}
     */
    private function buildAcademicSelectionPayload(Crawler $form, string $year, string $term): array
    {
        $fields = [];

        foreach ($form->filter('input[type="hidden"][name]') as $input) {
            $name = trim((string) ($input->getAttribute('name') ?? ''));
            if ($name === '') {
                continue;
            }

            $fields[$name] = (string) ($input->getAttribute('value') ?? '');
        }

        $fieldNames = [];
        foreach ($form->filter('[name]') as $node) {
            $name = trim((string) ($node->getAttribute('name') ?? ''));
            if ($name === '') {
                continue;
            }

            $fieldNames[$name] = $name;
        }

        $yearField = $this->findAcademicFieldName(array_values($fieldNames), 'year');
        $termField = $this->findAcademicFieldName(array_values($fieldNames), 'term');

        $hasFilters = false;

        if ($yearField !== null && $year !== '') {
            $fields[$yearField] = $this->resolveFormValueFromSelect($form, $yearField, $year, 'year');
            $hasFilters = true;
        }

        if ($termField !== null && $term !== '') {
            $fields[$termField] = $this->resolveFormValueFromSelect($form, $termField, $term, 'term');
            $hasFilters = true;
        }

        return [
            'has_filters' => $hasFilters,
            'fields' => $fields,
            'year_field' => $yearField,
            'term_field' => $termField,
        ];
    }

    /**
     * @param array<int, string> $fieldNames
     */
    private function findAcademicFieldName(array $fieldNames, string $target): ?string
    {
        $keywords = $target === 'year'
            ? ['year', 'academic', 'studyyear', 'study_year', 'year_id', 'ac_year', 'selectedyear']
            : ['term', 'semester', 'sem', 'term_id', 'semester_id', 'studyterm', 'study_term', 'selectedterm'];

        foreach ($fieldNames as $fieldName) {
            $normalized = mb_strtolower($fieldName);

            if (
                str_contains($normalized, 'password')
                || str_contains($normalized, 'username')
                || str_contains($normalized, 'token')
            ) {
                continue;
            }

            foreach ($keywords as $keyword) {
                if (str_contains($normalized, $keyword)) {
                    return $fieldName;
                }
            }
        }

        return null;
    }

    private function resolveFormValueFromSelect(
        Crawler $form,
        string $fieldName,
        string $requested,
        string $type
    ): string {
        $literal = $this->toXpathLiteral($fieldName);
        $select = $form->filterXPath("//select[@name={$literal}]");

        if (!$select->count()) {
            return $requested;
        }

        $requestedNormalized = $this->cleanText($requested);

        foreach ($select->first()->filter('option') as $option) {
            $value = $this->cleanText($option->getAttribute('value') ?? '');
            $text = $this->cleanText($option->textContent ?? '');

            if ($type === 'year' && $this->matchesOptionForYear($requestedNormalized, $value, $text)) {
                return $value !== '' ? $value : $text;
            }

            if ($type === 'term' && $this->matchesOptionForTerm($requestedNormalized, $value, $text)) {
                return $value !== '' ? $value : $text;
            }
        }

        return $requested;
    }

    private function matchesOptionForYear(string $requested, string $value, string $text): bool
    {
        $requestedDigits = preg_replace('/\D+/', '', $this->toWesternDigits($requested)) ?? '';
        $valueDigits = preg_replace('/\D+/', '', $this->toWesternDigits($value)) ?? '';
        $textDigits = preg_replace('/\D+/', '', $this->toWesternDigits($text)) ?? '';

        if ($requestedDigits !== '') {
            if ($valueDigits === $requestedDigits || $textDigits === $requestedDigits) {
                return true;
            }

            if ($textDigits !== '' && str_contains($textDigits, $requestedDigits)) {
                return true;
            }
        }

        return mb_strtolower($requested) === mb_strtolower($value)
            || mb_strtolower($requested) === mb_strtolower($text);
    }

    private function matchesOptionForTerm(string $requested, string $value, string $text): bool
    {
        $normalizedRequested = $this->normalizeAcademicTerm($requested);
        $tokens = $this->academicTermTokens($normalizedRequested);

        $valueLower = mb_strtolower($this->toWesternDigits($value));
        $textLower = mb_strtolower($this->toWesternDigits($text));

        foreach ($tokens as $token) {
            $normalizedToken = mb_strtolower($this->toWesternDigits($token));

            if ($normalizedToken !== '' && (
                $valueLower === $normalizedToken
                || $textLower === $normalizedToken
                || $this->containsToken($textLower, $normalizedToken)
            )) {
                return true;
            }
        }

        return false;
    }

    private function requestBody(string $url): string
    {
        $response = $this->client->get($url);
        $status = $response->getStatusCode();

        if ($status < 200 || $status >= 400) {
            throw new RuntimeException('Unexpected portal status code: '.$status);
        }

        return (string) $response->getBody();
    }

    private function assertLoginSucceeded(string $html): void
    {
        $crawler = new Crawler($html);

        $errorMessage = '';
        if ($crawler->filter('#theResult')->count()) {
            $errorMessage = $this->cleanText((string) $crawler->filter('#theResult')->attr('value'));
        }

        if ($errorMessage !== '') {
            throw new RuntimeException('Invalid student credentials: '.$errorMessage);
        }

        $bodyText = mb_strtolower($this->cleanText($crawler->filter('body')->text('')));
        $hasLoginForm = $crawler->filter('form#PerLogin, input[name="username"], input[name="password"]')->count() > 0;

        if ($hasLoginForm && (str_contains($bodyText, 'تسجيل الدخول') || str_contains($bodyText, 'بوابة الطالب'))) {
            throw new RuntimeException('Invalid student credentials for ZU portal.');
        }
    }

    private function ensureAuthenticated(): void
    {
        if (!$this->authenticated) {
            throw new RuntimeException('You must call login() before scraping portal data.');
        }
    }

    /**
     * @param array<int, string> $paths
     * @return array<int, string>
     */
    private function normalizePaths(array $paths): array
    {
        return array_values(array_filter(array_map(
            fn ($path) => trim((string) $path),
            $paths
        )));
    }

    private function toAbsoluteUrl(string $path): string
    {
        $base = rtrim((string) config('services.zu_portal.base_url', 'https://eservices.zu.edu.jo'), '/').'/';

        return (string) UriResolver::resolve(new Uri($base), new Uri($path));
    }

    private function resolveUrl(string $target, string $base): string
    {
        return (string) UriResolver::resolve(new Uri($base), new Uri($target));
    }

    private function detectCoursesTable(Crawler $crawler): ?Crawler
    {
        $bestTable = null;
        $bestScore = -1;

        foreach ($crawler->filter('table') as $tableNode) {
            $table = new Crawler($tableNode);
            $headers = $table->filter('th');
            $headerText = '';

            if ($headers->count()) {
                $headerText = mb_strtolower($this->cleanText(implode(' ', $headers->each(
                    fn (Crawler $th) => $th->text('')
                ))));
            } elseif ($table->filter('tr')->count()) {
                $headerText = mb_strtolower($this->cleanText($table->filter('tr')->first()->text('')));
            }

            $score = 0;
            if ($this->containsAny($headerText, ['المادة', 'المساق', 'المقرر', 'course', 'subject'])) {
                $score += 4;
            }
            if ($this->containsAny($headerText, ['علامة', 'درجة', 'تقدير', 'grade', 'mark'])) {
                $score += 3;
            }
            if ($this->containsAny($headerText, ['ساع', 'معتمدة', 'credit', 'hour'])) {
                $score += 3;
            }
            if ($this->containsAny($headerText, ['خطة', 'plan'])) {
                $score += 1;
            }

            if ($table->filter('tr')->count() >= 3) {
                $score += 1;
            }
            if ($table->filter('td')->count() >= 10) {
                $score += 1;
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestTable = $table;
            }

            $this->logDebug('courses_table_scored', [
                'score' => $score,
                'header_text' => $headerText,
            ]);
        }

        if ($bestTable && $bestScore > 0) {
            return $bestTable;
        }

        if ($crawler->filter('table')->count()) {
            return $crawler->filter('table')->first();
        }

        return null;
    }

    /**
        * @return array{name:?int,code:?int,grade:?int,credits:?int}
     */
    private function resolveHeaderMap(Crawler $table): array
    {
        $headers = $table->filter('thead th');
        if (!$headers->count()) {
            $headers = $table->filter('tr')->first()->filter('th,td');
        }

        $map = [
            'name' => null,
            'code' => null,
            'grade' => null,
            'credits' => null,
        ];

        foreach ($headers as $index => $header) {
            $text = mb_strtolower($this->cleanText($header->textContent ?? ''));

            if ($map['name'] === null && $this->containsAny($text, [
                'المادة',
                'اسم المادة',
                'المساق',
                'اسم المساق',
                'المقرر',
                'course',
                'course name',
                'subject',
            ])) {
                $map['name'] = $index;
            }

            if ($map['code'] === null && $this->containsAny($text, [
                'الرمز',
                'رمز',
                'كود',
                'رقم المادة',
                'course code',
                'code',
            ])) {
                $map['code'] = $index;
            }

            if ($map['grade'] === null && $this->containsAny($text, [
                'علامة',
                'العلامة',
                'درجة',
                'الدرجة',
                'تقدير',
                'grade',
                'mark',
                'result',
            ])) {
                $map['grade'] = $index;
            }

            if ($map['credits'] === null && $this->containsAny($text, [
                'ساع',
                'عدد الساعات',
                'معتمدة',
                'credit',
                'hours',
                'hour',
                'cr',
            ])) {
                $map['credits'] = $index;
            }
        }

        return $map;
    }

    /**
     * @param array<int, string> $labels
     */
    private function extractFieldByLabels(Crawler $crawler, array $labels): ?string
    {
        foreach ($labels as $label) {
            $literal = $this->toXpathLiteral($label);

            $rowValue = $crawler->filterXPath("//tr[th[contains(normalize-space(.), {$literal})] or td[contains(normalize-space(.), {$literal})]]/td[last()]");
            if ($rowValue->count()) {
                $value = $this->cleanText($rowValue->first()->text(''));
                if ($value !== '') {
                    return $value;
                }
            }

            $siblingValue = $crawler->filterXPath("//*[self::label or self::th or self::td][contains(normalize-space(.), {$literal})]/following-sibling::*[1]");
            if ($siblingValue->count()) {
                $value = $this->cleanText($siblingValue->first()->text(''));
                if ($value !== '') {
                    return $value;
                }
            }
        }

        return null;
    }

    /**
     * @param array<int, string> $selectors
     */
    private function extractFromSelectors(Crawler $crawler, array $selectors): ?string
    {
        foreach ($selectors as $selector) {
            if (!$crawler->filter($selector)->count()) {
                continue;
            }

            $value = $this->cleanText($crawler->filter($selector)->first()->text(''));
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    /**
     * @param array<int, string> $needles
     */
    private function containsAny(string $haystack, array $needles): bool
    {
        $normalizedHaystack = mb_strtolower($haystack);

        foreach ($needles as $needle) {
            if (str_contains($normalizedHaystack, mb_strtolower($needle))) {
                return true;
            }
        }

        return false;
    }

    private function containsToken(string $text, string $token): bool
    {
        if ($token === '') {
            return false;
        }

        if ((bool) preg_match('/^\d+$/', $token)) {
            return (bool) preg_match('/(^|\D)'.preg_quote($token, '/').'(\D|$)/', $text);
        }

        return str_contains($text, $token);
    }

    /**
     * @param array<int, string> $labels
     */
    private function extractFieldByInlineLabel(Crawler $crawler, array $labels): ?string
    {
        foreach ($labels as $label) {
            $literal = $this->toXpathLiteral($label);
            $nodes = $crawler->filterXPath("//*[self::li or self::div or self::span or self::p or self::td or self::th][contains(normalize-space(.), {$literal})]");

            foreach ($nodes as $node) {
                $text = $this->cleanText($node->textContent ?? '');
                if ($text === '' || mb_strlen($text) > 180) {
                    continue;
                }

                $value = $this->extractValueAfterLabel($text, $label);
                if ($value !== null && $value !== '') {
                    return $value;
                }
            }
        }

        return null;
    }

    private function extractValueAfterLabel(string $text, string $label): ?string
    {
        $escapedLabel = preg_quote($label, '/');

        if (preg_match('/'.$escapedLabel.'\s*[:：\-]\s*(.+)$/iu', $text, $matches)) {
            $value = $this->cleanText($matches[1] ?? '');
            return $value !== '' ? $value : null;
        }

        if (preg_match('/'.$escapedLabel.'\s+(.+)$/iu', $text, $matches)) {
            $value = $this->cleanText($matches[1] ?? '');
            return $value !== '' ? $value : null;
        }

        return null;
    }

    /**
     * @param array<int, string> $patterns
     */
    private function extractFromTextPatterns(string $text, array $patterns): ?string
    {
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $value = $this->cleanText($matches[1] ?? '');
                if ($value !== '') {
                    return $value;
                }
            }
        }

        return null;
    }

    /**
     * @param array{name:?int,code:?int,grade:?int,credits:?int} $headerMap
     */
    private function extractCourseNameFromRow(Crawler $cells, array $headerMap): string
    {
        $texts = [];

        for ($i = 0; $i < $cells->count(); $i++) {
            $texts[$i] = $this->cleanText($cells->eq($i)->text(''));
        }

        $preferredIndices = [];
        if (($headerMap['name'] ?? null) !== null) {
            $preferredIndices[] = (int) $headerMap['name'];
        }
        if (($headerMap['code'] ?? null) !== null) {
            $preferredIndices[] = (int) $headerMap['code'];
        }

        foreach ($preferredIndices as $index) {
            if (!array_key_exists($index, $texts)) {
                continue;
            }

            if ($this->isLikelyCourseName($texts[$index])) {
                return $texts[$index];
            }
        }

        $candidates = array_values(array_filter($texts, fn (string $text) => $this->isLikelyCourseName($text)));
        if (!empty($candidates)) {
            usort($candidates, fn (string $a, string $b) => mb_strlen($b) <=> mb_strlen($a));
            return $candidates[0];
        }

        foreach ($texts as $text) {
            if ($text !== '' && !$this->isSummaryText($text)) {
                return $text;
            }
        }

        return '';
    }

    /**
     * @param array{name:?int,code:?int,grade:?int,credits:?int} $headerMap
     */
    private function extractLikelyCodeRaw(Crawler $cells, array $headerMap): string
    {
        if (($headerMap['code'] ?? null) !== null) {
            $index = min((int) $headerMap['code'], $cells->count() - 1);
            $value = $this->cleanText($cells->eq($index)->text(''));
            if ($this->looksLikeCourseCodeToken($value)) {
                return $value;
            }
        }

        for ($i = 0; $i < $cells->count(); $i++) {
            $value = $this->cleanText($cells->eq($i)->text(''));
            if ($this->looksLikeCourseCodeToken($value)) {
                return $value;
            }
        }

        return '';
    }

    /**
     * @param array{name:?int,code:?int,grade:?int,credits:?int} $headerMap
     */
    private function extractLikelyGradeRaw(Crawler $cells, array $headerMap): string
    {
        if (($headerMap['grade'] ?? null) !== null) {
            $index = min((int) $headerMap['grade'], $cells->count() - 1);
            $value = $this->cleanText($cells->eq($index)->text(''));
            if ($value !== '') {
                return $value;
            }
        }

        for ($i = 0; $i < $cells->count(); $i++) {
            $value = $this->cleanText($cells->eq($i)->text(''));
            if ($this->looksLikeGradeToken($value)) {
                return $value;
            }
        }

        return '';
    }

    /**
     * @param array{name:?int,code:?int,grade:?int,credits:?int} $headerMap
     */
    private function extractLikelyCreditsRaw(Crawler $cells, array $headerMap): string
    {
        if (($headerMap['credits'] ?? null) !== null) {
            $index = min((int) $headerMap['credits'], $cells->count() - 1);
            $value = $this->cleanText($cells->eq($index)->text(''));
            $number = $this->parseNumber($value);
            if ($value !== '' && $number !== null && $number >= 0 && $number <= 25) {
                return $value;
            }
        }

        for ($i = 0; $i < $cells->count(); $i++) {
            $value = $this->cleanText($cells->eq($i)->text(''));
            $number = $this->parseNumber($value);

            if ($number !== null && $number >= 0 && $number <= 25 && !$this->looksLikeGradeToken($value)) {
                return $value;
            }
        }

        return '';
    }

    private function isLikelyCourseName(string $value): bool
    {
        $text = $this->cleanText($value);
        if ($text === '' || mb_strlen($text) < 2) {
            return false;
        }

        if ($this->isSummaryText($text) || $this->looksLikeGradeToken($text)) {
            return false;
        }

        if (preg_match('/^[0-9٠-٩\.,٫،\s]+$/u', $text)) {
            return false;
        }

        if (preg_match('/^[A-Za-z0-9\-\/]+$/', $text) && mb_strlen($text) <= 12) {
            return false;
        }

        return true;
    }

    private function isSummaryText(string $value): bool
    {
        return $this->containsAny($value, [
            'المجموع',
            'الاجمالي',
            'الإجمالي',
            'الساعات المجتازة',
            'المعدل',
            'gpa',
            'cgpa',
            'total',
            'summary',
        ]);
    }

    private function looksLikeGradeToken(string $value): bool
    {
        $text = mb_strtolower($this->cleanText($value));
        if ($text === '') {
            return false;
        }

        if (preg_match('/^(?:a\+?|b\+?|c\+?|d\+?|f|p|np|pass|fail|ناجح|راسب|مقبول|جيد|جيد جدا|ممتاز)$/iu', $text)) {
            return true;
        }

        $number = $this->parseNumber($text);
        return $number !== null && $number >= 0 && $number <= 100;
    }

    private function looksLikeCourseCodeToken(string $value): bool
    {
        $text = $this->toWesternDigits($this->cleanText($value));
        if ($text === '' || mb_strlen($text) > 24) {
            return false;
        }

        if (preg_match('/^[A-Za-z]{1,6}[\-\/ ]?\d{3,}$/', $text)) {
            return true;
        }

        return (bool) preg_match('/^\d{5,}$/', preg_replace('/\D+/', '', $text) ?? '');
    }

    /**
     * @param array<string, mixed> $context
     */
    private function logDebug(string $event, array $context = []): void
    {
        if (!$this->debugMode) {
            return;
        }

        Log::info('ZU portal scraper: '.$event, $context);
    }

    private function cleanText(?string $text): string
    {
        if ($text === null) {
            return '';
        }

        $decoded = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $decoded = str_replace(["\u{00A0}", "\u{200F}", "\u{200E}"], ' ', $decoded);

        return trim(preg_replace('/\s+/u', ' ', $decoded) ?? '');
    }

    private function toWesternDigits(string $value): string
    {
        return strtr($value, [
            '٠' => '0',
            '١' => '1',
            '٢' => '2',
            '٣' => '3',
            '٤' => '4',
            '٥' => '5',
            '٦' => '6',
            '٧' => '7',
            '٨' => '8',
            '٩' => '9',
        ]);
    }

    private function sanitizeExtractedField(?string $value, int $maxLength): ?string
    {
        if ($value === null) {
            return null;
        }

        $clean = $this->cleanText($value);
        if ($clean === '') {
            return null;
        }

        if (mb_strlen($clean) > $maxLength) {
            $clean = mb_substr($clean, 0, $maxLength);
        }

        return $clean;
    }

    private function parseNumber(?string $text): ?float
    {
        $clean = $this->cleanText($text);
        if ($clean === '') {
            return null;
        }

        $normalized = strtr($clean, [
            '٠' => '0',
            '١' => '1',
            '٢' => '2',
            '٣' => '3',
            '٤' => '4',
            '٥' => '5',
            '٦' => '6',
            '٧' => '7',
            '٨' => '8',
            '٩' => '9',
            '٫' => '.',
            ',' => '.',
            '،' => '.',
        ]);

        if (!preg_match('/-?\d+(?:\.\d+)?/', $normalized, $matches)) {
            return null;
        }

        return (float) $matches[0];
    }

    private function toXpathLiteral(string $value): string
    {
        if (!str_contains($value, "'")) {
            return "'{$value}'";
        }

        if (!str_contains($value, '"')) {
            return '"'.$value.'"';
        }

        $parts = explode("'", $value);
        $escapedParts = array_map(fn ($part) => "'{$part}'", $parts);

        return 'concat('.implode(', "\'", ', $escapedParts).')';
    }
}
