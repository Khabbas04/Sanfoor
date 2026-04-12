<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
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

    private bool $authenticated = false;

    public function __construct(?Client $client = null)
    {
        $baseUrl = rtrim((string) config('services.zu_portal.base_url', 'https://eservices.zu.edu.jo'), '/').'/';
        $verifyOption = $this->resolveSslVerifyOption();

        $this->loginPath = (string) config('services.zu_portal.login_path', '/StudentPortal2/Login/loginPage');
        $this->profilePaths = $this->normalizePaths((array) config('services.zu_portal.profile_paths', [
            '/StudentPortal2/Home/UniversityDegree',
            '/StudentPortal2/Home/HomePage',
            '/StudentPortal2/Student/Profile',
            '/StudentPortal2/StudentPortal/profile',
            '/StudentPortal2/Student/Main/profile',
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

        $name = $this->extractFieldByLabels($crawler, ['اسم الطالب', 'الاسم', 'Student Name', 'Name'])
            ?? $this->extractFromSelectors($crawler, ['#studentName', '.student-name', '.name']);

        $major = $this->extractFieldByLabels($crawler, ['التخصص', 'Major'])
            ?? $this->extractFromSelectors($crawler, ['#major', '.student-major', '.major']);

        $gpaRaw = $this->extractFieldByLabels($crawler, ['المعدل التراكمي', 'المعدل', 'GPA', 'CGPA'])
            ?? $this->extractFromSelectors($crawler, ['#gpa', '.student-gpa', '.gpa']);

        return [
            'name' => $name,
            'major' => $major,
            'gpa' => $this->parseNumber($gpaRaw),
            'gpa_raw' => $gpaRaw,
        ];
    }

    /**
     * Scrape passed courses table from the portal.
     *
     * @return array<int, array{course_name:string, grade:?float, grade_raw:?string, credits:?float}>
     */
    public function getCourses(): array
    {
        $this->ensureAuthenticated();

        [$html, $url] = $this->fetchFromCandidates($this->coursesPaths, [
            'المواد',
            'الخطة',
            'الخطة الدراسية',
            'الساعات',
            'العلامة',
            'Course',
            'Plan',
        ]);

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

            $nameIndex = $headerMap['name'] ?? 0;
            $gradeIndex = $headerMap['grade'] ?? max(0, $cells->count() - 2);
            $creditsIndex = $headerMap['credits'] ?? max(0, $cells->count() - 1);

            $courseName = $this->cleanText($cells->eq(min($nameIndex, $cells->count() - 1))->text(''));
            if ($courseName === '') {
                continue;
            }

            $gradeRaw = $this->cleanText($cells->eq(min($gradeIndex, $cells->count() - 1))->text(''));
            $creditsRaw = $this->cleanText($cells->eq(min($creditsIndex, $cells->count() - 1))->text(''));

            $courses[] = [
                'course_name' => $courseName,
                'grade' => $this->parseNumber($gradeRaw),
                'grade_raw' => $gradeRaw !== '' ? $gradeRaw : null,
                'credits' => $this->parseNumber($creditsRaw),
            ];
        }

        return $courses;
    }

    /**
     * @param array<int, string> $paths
     * @param array<int, string> $keywords
     * @return array{0:string,1:string}
     */
    private function fetchFromCandidates(array $paths, array $keywords = []): array
    {
        $lastHtml = null;
        $lastUrl = null;

        foreach ($paths as $path) {
            $absolute = $this->toAbsoluteUrl($path);

            try {
                $html = $this->requestBody($path);
                $text = mb_strtolower($this->cleanText(strip_tags($html)));
                $matchesKeywords = empty($keywords);

                foreach ($keywords as $keyword) {
                    if (str_contains($text, mb_strtolower($keyword))) {
                        $matchesKeywords = true;
                        break;
                    }
                }

                $lastHtml = $html;
                $lastUrl = $absolute;

                if ($matchesKeywords) {
                    return [$html, $absolute];
                }
            } catch (Throwable) {
                continue;
            }
        }

        if ($lastHtml !== null && $lastUrl !== null) {
            return [$lastHtml, $lastUrl];
        }

        throw new RuntimeException('Unable to locate the target portal page after login.');
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
        foreach ($crawler->filter('table') as $tableNode) {
            $table = new Crawler($tableNode);
            $headers = $table->filter('th');
            $headerText = '';

            if ($headers->count()) {
                $headerText = mb_strtolower($this->cleanText(implode(' ', $headers->each(
                    fn (Crawler $th) => $th->text('')
                ))));
            }

            if (
                str_contains($headerText, 'المادة')
                || str_contains($headerText, 'علامة')
                || str_contains($headerText, 'grade')
                || str_contains($headerText, 'credit')
            ) {
                return $table;
            }
        }

        if ($crawler->filter('table')->count()) {
            return $crawler->filter('table')->first();
        }

        return null;
    }

    /**
     * @return array{name:?int,grade:?int,credits:?int}
     */
    private function resolveHeaderMap(Crawler $table): array
    {
        $headers = $table->filter('thead th');
        if (!$headers->count()) {
            $headers = $table->filter('tr')->first()->filter('th,td');
        }

        $map = [
            'name' => null,
            'grade' => null,
            'credits' => null,
        ];

        foreach ($headers as $index => $header) {
            $text = mb_strtolower($this->cleanText($header->textContent ?? ''));

            if ($map['name'] === null && (str_contains($text, 'المادة') || str_contains($text, 'course'))) {
                $map['name'] = $index;
            }

            if ($map['grade'] === null && (str_contains($text, 'علامة') || str_contains($text, 'grade') || str_contains($text, 'mark'))) {
                $map['grade'] = $index;
            }

            if ($map['credits'] === null && (str_contains($text, 'ساع') || str_contains($text, 'credit') || str_contains($text, 'hour'))) {
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

    private function cleanText(?string $text): string
    {
        if ($text === null) {
            return '';
        }

        $decoded = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $decoded = str_replace(["\u{00A0}", "\u{200F}", "\u{200E}"], ' ', $decoded);

        return trim(preg_replace('/\s+/u', ' ', $decoded) ?? '');
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
