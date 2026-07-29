<?php

namespace App\Models;

use App\Support\AcademicCache;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class AcademicPeriod extends Model
{
    use HasFactory;

    protected static function booted()
    {
        // Any write to a period retires every cached thing derived from it: the
        // student's academic snapshot, the available-course pool, the planner's
        // roadmap, the advisor's stored answers. Doing it here rather than in the
        // admin controller means a term change propagates no matter which code path
        // performed it — a console command, a seeder, a future screen.
        static::saved(function () {
            AcademicCache::bump();
            \Illuminate\Support\Facades\Cache::increment('academic_insights_version');
        });
        static::deleted(function () {
            AcademicCache::bump();
            \Illuminate\Support\Facades\Cache::increment('academic_insights_version');
        });
    }

    protected $fillable = [
        'academic_year',
        'academic_term',
        'label',
        'is_current',
    ];

    protected $casts = [
        'academic_term' => 'integer',
        'is_current' => 'boolean',
    ];

    public static function current(): ?self
    {
        return \Illuminate\Support\Facades\Cache::remember('academic_period_current', 3600, function () {
            try {
                // `id` breaks the tie: two rows written in the same second are
                // otherwise ordered arbitrarily, and "the current academic term" is
                // not a question that may have an arbitrary answer.
                return static::query()
                    ->where('is_current', true)
                    ->orderByDesc('updated_at')
                    ->orderByDesc('id')
                    ->first()
                    ?? static::query()->orderByDesc('updated_at')->orderByDesc('id')->first();
            } catch (\Exception $e) {
                return null;
            }
        });
    }

    public static function termLabel(?int $term): string
    {
        return match ((int) $term) {
            1 => 'الفصل الأول',
            2 => 'الفصل الثاني',
            3 => 'الفصل الصيفي',
            default => 'الفصل الدراسي',
        };
    }

    public function displayLabel(): string
    {
        $customLabel = trim((string) $this->label);
        if ($customLabel !== '') {
            return $customLabel;
        }

        return trim(sprintf('%s %s', $this->academic_year, self::termLabel((int) $this->academic_term)));
    }

    /* ── term identity ──────────────────────────────────────────────────── */

    /** 'regular' or 'summer', from config/academic_terms.php. */
    public static function termType(?int $term): string
    {
        return (string) (config("academic_terms.terms.{$term}.type") ?? 'regular');
    }

    public function isSummer(): bool
    {
        return self::termType((int) $this->academic_term) === 'summer';
    }

    /**
     * The registration ceiling for this term, in credit hours.
     *
     * The one place that answers "how many hours may this student take". A student
     * on probation gets the lower of their academic cap and the term cap; a
     * graduating student gets the documented exception.
     */
    public static function maxHoursFor(?int $term, bool $isProbation = false, bool $isGraduating = false): int
    {
        $limits = (array) config('academic_terms.limits');
        $isSummer = self::termType($term) === 'summer';

        if ($isGraduating) {
            return (int) ($isSummer ? $limits['graduating_summer'] : $limits['graduating_regular']);
        }

        $termLimit = (int) ($isSummer ? $limits['summer'] : $limits['regular']);

        return $isProbation ? min($termLimit, (int) $limits['probation']) : $termLimit;
    }

    public function maxHours(bool $isProbation = false, bool $isGraduating = false): int
    {
        return self::maxHoursFor((int) $this->academic_term, $isProbation, $isGraduating);
    }

    /** Hours a plan should aim for in this term — not the legal ceiling. */
    public static function targetHoursFor(?int $term): int
    {
        $key = self::termType($term) === 'summer' ? 'summer' : 'regular';

        return (int) config("academic_terms.target_hours.{$key}", 15);
    }

    /* ── sequence ───────────────────────────────────────────────────────── */

    /**
     * The term that follows this one, with the year advanced when the summer term
     * closes the academic year.
     *
     * @return array{academic_year: string, academic_term: int, label: string, type: string}
     */
    public function nextTerm(): array
    {
        return self::termAfter((string) $this->academic_year, (int) $this->academic_term);
    }

    /** @return array{academic_year: string, academic_term: int, label: string, type: string} */
    public static function termAfter(string $academicYear, int $term): array
    {
        $definition = (array) config("academic_terms.terms.{$term}", []);
        $next = (int) ($definition['next'] ?? 1);
        $year = ($definition['rolls_year'] ?? false)
            ? self::advanceYear($academicYear)
            : $academicYear;

        return [
            'academic_year' => $year,
            'academic_term' => $next,
            'label' => self::termLabel($next),
            'type' => self::termType($next),
        ];
    }

    /**
     * The next $count terms after this one — what the roadmap walks through, so a
     * predicted semester can be named ("الفصل الصيفي 2026/2027") instead of
     * described only by its position.
     *
     * @return list<array{academic_year: string, academic_term: int, label: string, type: string}>
     */
    public function upcomingTerms(int $count = 3): array
    {
        $terms = [];
        $year = (string) $this->academic_year;
        $term = (int) $this->academic_term;

        for ($i = 0; $i < max(0, $count); $i++) {
            $next = self::termAfter($year, $term);
            $terms[] = $next;
            $year = $next['academic_year'];
            $term = $next['academic_term'];
        }

        return $terms;
    }

    /**
     * "2026/2027" → "2027/2028", "2026" → "2027".
     *
     * Both shapes exist in this database, so both are handled rather than assuming
     * the one the current row happens to use.
     */
    public static function advanceYear(string $academicYear): string
    {
        if (preg_match('/^(\d{4})\s*[\/\-]\s*(\d{4})$/', trim($academicYear), $matches)) {
            return ((int) $matches[1] + 1) . '/' . ((int) $matches[2] + 1);
        }

        if (preg_match('/^(\d{4})$/', trim($academicYear), $matches)) {
            return (string) ((int) $matches[1] + 1);
        }

        // An unrecognised format is left alone: inventing a year would be worse
        // than repeating the current one.
        return $academicYear;
    }
}
