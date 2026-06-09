<?php
// Generate a simple notification chime WAV file
$sampleRate = 22050;
$duration = 0.35;
$numSamples = intval($sampleRate * $duration);
$data = '';

for ($i = 0; $i < $numSamples; $i++) {
    $t = $i / $sampleRate;
    // Descending frequency chirp from 1200Hz
    $freq = 1200 * pow(2, -$t * 3);
    // Exponential decay envelope
    $envelope = exp(-$t * 10);
    // Add a second harmonic for richness
    $sample = 0.5 * $envelope * (
        0.7 * sin(2 * M_PI * $freq * $t) +
        0.3 * sin(2 * M_PI * $freq * 1.5 * $t)
    );
    $intSample = intval(32767 * max(-1, min(1, $sample)));
    $data .= pack('v', $intSample & 0xFFFF);
}

$dataSize = strlen($data);
$header = 'RIFF' . pack('V', $dataSize + 36) . 'WAVEfmt ' . pack('VvvVVvv', 16, 1, 1, $sampleRate, $sampleRate * 2, 2, 16) . 'data' . pack('V', $dataSize);

file_put_contents(__DIR__ . '/../public/sounds/notification.wav', $header . $data);
echo 'Generated notification.wav: ' . strlen($header . $data) . " bytes\n";
