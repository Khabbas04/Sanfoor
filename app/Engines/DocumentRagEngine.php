<?php

namespace App\Engines;

use App\Services\GeminiService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DocumentRagEngine
{
    /** Cache key holding all chunks with their decoded embedding vectors. */
    private const CHUNKS_CACHE_KEY = 'rag_document_chunks_v1';
    private const CHUNKS_CACHE_TTL = 3600; // 1h; also invalidated explicitly on ingest.
    private const QUERY_EMBED_TTL = 600;   // repeated identical questions reuse the vector.

    public function __construct(private GeminiService $gemini) {}

    /**
     * Ingest a document, chunk it by legal Article, embed each chunk and store it.
     */
    public function ingestDocument(string $name, string $text): void
    {
        // Chunk by Article "**المادة" to keep context intact with Article numbers.
        $parts = explode('**المادة', $text);

        $chunks = [];
        if (trim($parts[0]) !== '') {
            $chunks[] = trim($parts[0]);
        }
        for ($i = 1; $i < count($parts); $i++) {
            $chunkText = trim('**المادة' . $parts[$i]);
            if ($chunkText !== '') {
                $chunks[] = $chunkText;
            }
        }

        foreach ($chunks as $index => $chunkText) {
            $embedding = $this->gemini->embedContent($chunkText);
            if ($embedding) {
                DB::table('document_chunks')->insert([
                    'document_name' => $name,
                    'chunk_text' => $chunkText,
                    'chunk_index' => $index,
                    'embedding' => json_encode($embedding),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                Log::warning("RAG ingest: failed to embed chunk #{$index} of document '{$name}'");
            }
        }

        // New content invalidates the cached vector set.
        Cache::forget(self::CHUNKS_CACHE_KEY);
    }

    public function search(string $query, int $topK = 3): array
    {
        $query = trim($query);
        if ($query === '') {
            return [];
        }

        $chunks = $this->loadChunks();
        if (empty($chunks)) {
            return [];
        }

        $queryEmbedding = $this->embedQuery($query);
        if (!$queryEmbedding) {
            // Embedding unavailable (keys down / rate limited) — already logged upstream.
            return [];
        }

        $scoredChunks = [];
        foreach ($chunks as $chunk) {
            $scoredChunks[] = [
                'text' => $chunk['text'],
                'document' => $chunk['document'],
                'similarity' => $this->cosineSimilarity($queryEmbedding, $chunk['embedding']),
            ];
        }

        usort($scoredChunks, fn ($a, $b) => $b['similarity'] <=> $a['similarity']);

        $results = [];
        foreach (array_slice($scoredChunks, 0, $topK) as $sc) {
            if ($sc['similarity'] > 0.55) {
                $results[] = $sc;
            }
        }

        return $results;
    }

    /**
     * Load all chunks with pre-decoded embedding vectors, cached to avoid a full
     * table scan + JSON decode of every embedding on every single question.
     */
    private function loadChunks(): array
    {
        return Cache::remember(self::CHUNKS_CACHE_KEY, self::CHUNKS_CACHE_TTL, function () {
            $rows = DB::table('document_chunks')
                ->select('chunk_text', 'document_name', 'embedding')
                ->get();

            $chunks = [];
            foreach ($rows as $row) {
                $embedding = json_decode($row->embedding, true);
                if (is_array($embedding) && !empty($embedding)) {
                    $chunks[] = [
                        'text' => $row->chunk_text,
                        'document' => $row->document_name,
                        'embedding' => $embedding,
                    ];
                }
            }

            return $chunks;
        });
    }

    /**
     * Embed the (optionally expanded) query, caching identical queries briefly.
     */
    private function embedQuery(string $query): ?array
    {
        $expanded = $this->expandQuery($query);
        $cacheKey = 'rag_query_embed_' . md5($expanded);

        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $embedding = $this->gemini->embedContent($expanded);
        if ($embedding) {
            Cache::put($cacheKey, $embedding, self::QUERY_EMBED_TTL);
        }

        return $embedding;
    }

    /**
     * Optionally rewrite the student query into a formal academic search query.
     * Disabled by default (services.gemini.rag_query_expansion) because it costs
     * an extra LLM round-trip and a request from the RPM budget per question.
     */
    private function expandQuery(string $query): string
    {
        if (!config('services.gemini.rag_query_expansion', false)) {
            return $query;
        }

        try {
            $prompt = "You are a university academic search assistant. Rewrite the following student query into a formal, concise academic search query to find the relevant university laws or regulations. Do not answer the question. Only output the formal search query in Arabic.\nStudent query: " . $query;

            $expanded = trim($this->gemini->callGeminiAPI(
                [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                [
                    'generationConfig' => [
                        'maxOutputTokens' => 50,
                        'temperature' => 0.1,
                        'responseMimeType' => 'text/plain',
                    ],
                    'timeout' => 5,
                ]
            ));

            if (mb_strlen($expanded) > 5) {
                // Combine original + expanded for maximum vector surface area.
                return $query . ' ' . $expanded;
            }
        } catch (\Throwable $e) {
            Log::debug('RAG query expansion failed, using raw query: ' . $e->getMessage());
        }

        return $query;
    }

    private function cosineSimilarity(array $vec1, array $vec2): float
    {
        $dotProduct = 0.0;
        $normA = 0.0;
        $normB = 0.0;

        $count = min(count($vec1), count($vec2));
        for ($i = 0; $i < $count; $i++) {
            $dotProduct += $vec1[$i] * $vec2[$i];
            $normA += $vec1[$i] * $vec1[$i];
            $normB += $vec2[$i] * $vec2[$i];
        }

        if ($normA == 0.0 || $normB == 0.0) {
            return 0.0;
        }

        return $dotProduct / (sqrt($normA) * sqrt($normB));
    }

    public function isRelevantQuery(string $query): bool
    {
        $keywords = [
            'قانون', 'غياب', 'حرمان', 'رسوب', 'تأجيل', 'فصل', 'إنذار', 'عقوبة', 'غش',
            'استنكاف', 'انسحاب', 'معدل', 'شروط', 'تعليمات', 'دليل', 'كم غياب',
        ];

        foreach ($keywords as $kw) {
            if (mb_strpos($query, $kw) !== false) {
                return true;
            }
        }

        return false;
    }
}
