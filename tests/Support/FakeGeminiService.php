<?php

namespace Tests\Support;

use App\Services\GeminiService;

/**
 * Test double for GeminiService.
 *
 * The advisor pipeline is exercised end to end (RAG, ranking, validation, widget
 * sanitising, cart writes), so the only thing that must not happen in a test is
 * the network call. Everything else runs for real.
 *
 * The streaming variant is faked here rather than through Http::fake() because
 * GeminiService::streamGeminiAPI() deliberately uses raw cURL, which no HTTP
 * fake can intercept.
 */
class FakeGeminiService extends GeminiService
{
    /** @var list<string> Raw model replies handed out in order, last one repeating. */
    private array $responses;

    /** @var list<array{contents: array, options: array, streamed: bool}> */
    public array $calls = [];

    public function __construct(array $responses = [], private array $keys = ['test-key'])
    {
        $this->responses = $responses === [] ? ['{"reply":"جواب اختباري 🙂"}'] : array_values($responses);
    }

    public function getApiKeys(): array
    {
        return $this->keys;
    }

    public function callGeminiAPI(array $contents, array $options = [], array $apiKeys = null): string
    {
        $this->calls[] = ['contents' => $contents, 'options' => $options, 'streamed' => false];

        return $this->nextResponse();
    }

    public function streamGeminiAPI(array $contents, array $options, callable $onChunk): string
    {
        $this->calls[] = ['contents' => $contents, 'options' => $options, 'streamed' => true];

        $raw = $this->nextResponse();

        // Hand the document over in small slices so the controller's partial-JSON
        // reader is exercised the same way a real stream exercises it.
        foreach (str_split($raw, 24) as $slice) {
            $onChunk($slice);
        }

        return $raw;
    }

    public function embedContent(string $text, array $apiKeys = null): ?array
    {
        // No document RAG in tests: returning null is the documented "unavailable"
        // path and keeps DocumentRagEngine from reaching the network.
        return null;
    }

    /** The system instruction sent on the last call, for prompt assertions. */
    public function lastSystemInstruction(): string
    {
        $last = end($this->calls);

        return (string) ($last['options']['systemInstruction']['parts'][0]['text'] ?? '');
    }

    /**
     * Marker a test can queue instead of a document to make that call fail the
     * way GeminiService fails when every key is exhausted.
     */
    public const FAIL = '__gemini_failure__';

    private function nextResponse(): string
    {
        $raw = count($this->responses) > 1
            ? array_shift($this->responses)
            : $this->responses[0];

        if ($raw === self::FAIL) {
            throw new \Exception('Gemini API failed across all keys. Last error: test failure');
        }

        return $raw;
    }
}
