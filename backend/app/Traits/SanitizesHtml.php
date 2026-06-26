<?php

namespace App\Traits;

use Mews\Purifier\Facades\Purifier;

trait SanitizesHtml
{
    /**
     * Sanitize HTML content using HTMLPurifier
     *
     * @param string|null $html
     * @return string|null
     */
    protected function sanitizeHtml(?string $html): ?string
    {
        if (!$html) {
            return null;
        }

        return Purifier::clean($html, 'default');
    }

    /**
     * Extract the first image URL from HTML content
     *
     * @param string|null $html
     * @return string|null
     */
    protected function extractFirstImage(?string $html): ?string
    {
        if (!$html) {
            return null;
        }

        preg_match('/<img[^>]+src="([^">]+)"/', $html, $matches);
        return $matches[1] ?? null;
    }

    /**
     * Strip all HTML tags from content
     *
     * @param string|null $html
     * @return string|null
     */
    protected function stripHtml(?string $html): ?string
    {
        if (!$html) {
            return null;
        }

        return strip_tags($html);
    }

    /**
     * Calculate reading time based on word count
     *
     * @param string $html
     * @param int $wordsPerMinute
     * @return int
     */
    protected function calculateReadingTime(string $html, int $wordsPerMinute = 200): int
    {
        $wordCount = str_word_count(strip_tags($html));
        return (int) ceil($wordCount / $wordsPerMinute);
    }
}
