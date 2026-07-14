<?php

namespace App\Engines;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class DocumentRagEngine
{
    private string $apiKey;

    public function __construct()
    {
        $this->apiKey = env('GEMINI_API_KEY', '');
    }

    /**
     * Ingest a document, chunk it, get embeddings, and store in the database.
     */
    public function ingestDocument(string $name, string $text): void
    {
        // Simple chunking logic: split by newlines, group into chunks of ~500 chars
        $paragraphs = explode("\n", $text);
        $chunks = [];
        $currentChunk = "";

        foreach ($paragraphs as $p) {
            $p = trim($p);
            if (empty($p)) continue;

            if (mb_strlen($currentChunk . " " . $p) > 500) {
                if (!empty($currentChunk)) {
                    $chunks[] = $currentChunk;
                }
                $currentChunk = $p;
            } else {
                $currentChunk .= (empty($currentChunk) ? "" : " ") . $p;
            }
        }
        if (!empty($currentChunk)) {
            $chunks[] = $currentChunk;
        }

        // Generate embeddings for each chunk
        foreach ($chunks as $index => $chunkText) {
            $embedding = $this->getEmbedding($chunkText);
            if ($embedding) {
                DB::table('document_chunks')->insert([
                    'document_name' => $name,
                    'chunk_text' => $chunkText,
                    'chunk_index' => $index,
                    'embedding' => json_encode($embedding),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Search for the most relevant document chunks for a given query.
     */
    public function search(string $query, int $topK = 3): array
    {
        if (empty($this->apiKey) || !$this->isRelevantQuery($query)) {
            return [];
        }

        $queryEmbedding = $this->getEmbedding($query);
        if (!$queryEmbedding) {
            return [];
        }

        $chunks = DB::table('document_chunks')->get();
        $scoredChunks = [];

        foreach ($chunks as $chunk) {
            $chunkEmbedding = json_decode($chunk->embedding, true);
            if (is_array($chunkEmbedding)) {
                $similarity = $this->cosineSimilarity($queryEmbedding, $chunkEmbedding);
                $scoredChunks[] = [
                    'text' => $chunk->chunk_text,
                    'document' => $chunk->document_name,
                    'similarity' => $similarity
                ];
            }
        }

        // Sort descending by similarity
        usort($scoredChunks, fn($a, $b) => $b['similarity'] <=> $a['similarity']);

        // Return top K with a reasonable similarity threshold
        $results = [];
        foreach (array_slice($scoredChunks, 0, $topK) as $sc) {
            if ($sc['similarity'] > 0.65) {
                $results[] = $sc;
            }
        }

        return $results;
    }

    private function getEmbedding(string $text): ?array
    {
        if (empty($this->apiKey)) return null;

        $url = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={$this->apiKey}";
        
        try {
            $response = Http::withoutVerifying()->post($url, [
                'model' => 'models/text-embedding-004',
                'content' => [
                    'parts' => [['text' => $text]]
                ]
            ]);

            if ($response->successful()) {
                $data = $response->json();
                return $data['embedding']['values'] ?? null;
            }
        } catch (\Exception $e) {
            return null;
        }

        return null;
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

        if ($normA == 0 || $normB == 0) {
            return 0.0;
        }

        return $dotProduct / (sqrt($normA) * sqrt($normB));
    }

    public function isRelevantQuery(string $query): bool
    {
        $keywords = [
            'قانون', 'غياب', 'حرمان', 'رسوب', 'تأجيل', 'فصل', 'إنذار', 'عقوبة', 'غش', 
            'استنكاف', 'انسحاب', 'معدل', 'شروط', 'تعليمات', 'دليل', 'كم غياب'
        ];

        foreach ($keywords as $kw) {
            if (mb_strpos($query, $kw) !== false) {
                return true;
            }
        }

        return false;
    }
}
