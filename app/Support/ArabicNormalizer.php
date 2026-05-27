<?php

namespace App\Support;

class ArabicNormalizer
{
    /**
     * Normalize Arabic string by standardizing letters and removing diacritics.
     */
    public static function normalize(?string $text): string
    {
        if ($text === null) {
            return '';
        }

        // Trim whitespace
        $text = trim($text);

        // Convert to lowercase
        $text = mb_strtolower($text, 'UTF-8');

        // Replace Alif variants (أ, إ, آ, ٱ) with bare Alif (ا)
        $text = preg_replace('/[أإآٱ]/u', 'ا', $text);

        // Replace Teh Marbuta (ة) with Heh (ه)
        $text = preg_replace('/ة/u', 'ه', $text);

        // Replace Alif Maksura (ى) with Yeh (ي)
        $text = preg_replace('/ى/u', 'ي', $text);

        // Remove Arabic diacritics (harakat)
        $diacritics = [
            'ِ', 'ُ', 'َ', 'ً', 'ٌ', 'ٍ', 'ّ', 'ْ',
        ];
        $text = str_replace($diacritics, '', $text);

        // Replace multiple spaces with a single space
        $text = preg_replace('/\s+/u', ' ', $text);

        return $text;
    }
}
