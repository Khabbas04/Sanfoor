<?php

namespace App\AiTools;

use App\AiTools\Concerns\BuildsToolResults;
use App\Engines\ValidationEngine;
use App\Models\Landmark;
use App\Models\User;

/**
 * Where is it on campus?
 *
 * Landmarks are the only directory data that exists, so an answer is either a
 * real landmark row or an honest "not listed" — never a described building that
 * the model assumed is there.
 */
class SearchCampusDirectoryTool implements AiTool
{
    use BuildsToolResults;

    public function __construct(private ValidationEngine $validator) {}

    public function name(): string
    {
        return 'search_campus_directory';
    }

    public function description(): string
    {
        return 'البحث عن مبنى أو دائرة أو معلم داخل الحرم الجامعي وموقعه.';
    }

    public function parameters(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => ['query' => ['type' => 'STRING', 'description' => 'اسم المكان أو الدائرة']],
            'required' => ['query'],
        ];
    }

    public function run(User $user, array $arguments): array
    {
        $query = trim((string) ($arguments['query'] ?? ''));
        if ($query === '') {
            return $this->fail('missing_query', 'يجب تحديد اسم المكان المطلوب.');
        }

        $landmarks = Landmark::query()
            ->where('is_active', true)
            ->get(['id', 'name', 'description', 'type', 'building_location', 'maps_url']);

        if ($landmarks->isEmpty()) {
            return $this->unavailable('دليل الحرم الجامعي', 'دائرة القبول والتسجيل');
        }

        $check = $this->validator->validateCampusPlace($query, $landmarks->pluck('name', 'id')->all());

        if (!$check['valid']) {
            return [
                'ok' => false,
                'data' => [
                    'available' => true,
                    'matched' => null,
                    // Offering the real list beats inventing the one that was asked for.
                    'known_places' => $landmarks->pluck('name')->all(),
                ],
                'errors' => $check['errors'],
                'warnings' => [],
                'sources' => [],
            ];
        }

        $landmark = $landmarks->firstWhere('id', $check['matched_id']);

        return $this->ok([
            'available' => true,
            'matched' => [
                'id' => $landmark->id,
                'name' => $landmark->name,
                'type' => $landmark->type,
                'description' => $landmark->description,
                'building_location' => $landmark->building_location,
                'maps_url' => $landmark->maps_url,
            ],
        ], [[
            'type' => 'campus_directory',
            'label' => 'دليل الحرم الجامعي',
            'entity_ids' => [(int) $landmark->id],
        ]]);
    }
}
