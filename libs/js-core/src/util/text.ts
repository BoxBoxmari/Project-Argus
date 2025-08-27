/**
 * Text normalization and processing utilities
 * Based on patterns from Project Argus Master Scraper
 */

/**
 * Normalize whitespace and cleanup text
 */
export function normalizeWhitespace(text: string): string {
    if (!text) return '';

    return text
        .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // Replace various space characters
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();
}

/**
 * Clamp a number between min and max values
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Convert relative time to ISO format (basic patterns)
 */
export function toISOFromRelative(relativeTime: string): string | null {
    if (!relativeTime) return null;

    const now = new Date();
    const text = relativeTime.toLowerCase().trim();

    // Common patterns
    if (text.includes('ago')) {
        // "2 days ago", "3 weeks ago", etc.
        const match = text.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/);
        if (match) {
            const amount = parseInt(match[1]);
            const unit = match[2];

            const result = new Date(now);
            switch (unit) {
                case 'minute':
                    result.setMinutes(result.getMinutes() - amount);
                    break;
                case 'hour':
                    result.setHours(result.getHours() - amount);
                    break;
                case 'day':
                    result.setDate(result.getDate() - amount);
                    break;
                case 'week':
                    result.setDate(result.getDate() - (amount * 7));
                    break;
                case 'month':
                    result.setMonth(result.getMonth() - amount);
                    break;
                case 'year':
                    result.setFullYear(result.getFullYear() - amount);
                    break;
            }

            return result.toISOString();
        }
    }

    // Try parsing as date
    try {
        const parsed = new Date(relativeTime);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
        }
    } catch (e) {
        // Continue with other patterns
    }

    return null;
}

/**
 * Extract numeric value from text (ratings, counts, etc.)
 */
export function extractNumber(text: string): number | null {
    if (!text) return null;

    // Handle decimal separators (both . and ,)
    const match = text.match(/([\d.,]+)/);
    if (match) {
        const numStr = match[1]
            .replace(/[.,](?=\d{3}\b)/g, '') // Remove thousands separators
            .replace(',', '.'); // Convert decimal comma to dot

        const num = parseFloat(numStr);
        return isNaN(num) ? null : num;
    }

    return null;
}

/**
 * Clean and normalize review text
 */
export function normalizeReviewText(text: string): string {
    if (!text) return '';

    return normalizeWhitespace(text)
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes
        .replace(/\.\.\.$/, '') // Remove trailing ellipsis
        .substring(0, 10000); // Reasonable length limit
}

/**
 * Extract place ID from various URL formats
 */
export function extractPlaceId(url: string): string {
    if (!url) return '';

    // Try different URL patterns
    const patterns = [
        /\/place\/([^\/\?]+)/,           // /place/place-name
        /place_id=([^&]+)/,              // place_id parameter
        /data=([^&]+)/,                  // data parameter
        /cid:(\d+)/,                     // cid format
        /@([^,]+),([^,]+),([^z]+)z/      // coordinates format
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }

    // Fallback to full URL
    return url;
}

/**
 * Normalize place key (from userscript normalizePlaceKey)
 */
export function normalizePlaceKey(url: string): string {
    try {
        // Remove protocol and www
        let normalized = url
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '');

        // Extract key parts
        const parts = normalized.split('/');
        if (parts.length >= 3 && parts[1] === 'maps' && parts[2] === 'place') {
            // Extract place name
            const placeName = parts[3]?.split('/@')[0] || '';
            return placeName;
        }

        // Fallback
        return normalized.split('?')[0];
    } catch (e) {
        return url;
    }
}

/**
 * Safe text extraction from DOM elements
 */
export function safeTextContent(element: any, selector?: string): string {
    try {
        const target = selector ? element.querySelector?.(selector) : element;
        const text = target?.textContent || target?.innerText || '';
        return normalizeWhitespace(text);
    } catch (e) {
        return '';
    }
}

/**
 * Safe attribute extraction from DOM elements
 */
export function safeAttribute(element: any, attribute: string, selector?: string): string {
    try {
        const target = selector ? element.querySelector?.(selector) : element;
        return target?.getAttribute?.(attribute) || '';
    } catch (e) {
        return '';
    }
}

/**
 * Generate safe filename from text
 */
export function toSafeFilename(text: string, maxLength = 50): string {
    if (!text) return 'unnamed';

    return normalizeWhitespace(text)
        .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid filename characters
        .replace(/\s+/g, '-') // Replace spaces with dashes
        .replace(/-+/g, '-') // Collapse multiple dashes
        .replace(/^-|-$/g, '') // Remove leading/trailing dashes
        .substring(0, maxLength)
        .toLowerCase();
}

/**
 * Format number with locale-appropriate separators
 */
export function formatNumber(num: number, locale = 'en-US'): string {
    try {
        return new Intl.NumberFormat(locale).format(num);
    } catch (e) {
        return num.toString();
    }
}

/**
 * Calculate reading time estimate for text
 */
export function estimateReadingTime(text: string, wordsPerMinute = 200): number {
    if (!text) return 0;

    const words = normalizeWhitespace(text).split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number, suffix = '...'): string {
    if (!text || text.length <= maxLength) return text;

    const truncated = text.substring(0, maxLength - suffix.length);
    const lastSpace = truncated.lastIndexOf(' ');

    // Try to break at word boundary
    if (lastSpace > maxLength * 0.7) {
        return truncated.substring(0, lastSpace) + suffix;
    }

    return truncated + suffix;
}