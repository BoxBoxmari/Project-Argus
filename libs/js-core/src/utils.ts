export function sanitizeText(text: string): string {
    return text.replace(/[\r\n\t]+/g, ' ').trim();
}

export function extractPlaceId(url: string): string | null {
    const match = url.match(/place\/([^\/\?]+)/);
    return match ? match[1] : null;
}

export function generateReviewId(placeId: string, author: string, timestamp: string): string {
    const hash = Array.from(placeId + author + timestamp)
        .reduce((acc, char) => acc + char.charCodeAt(0), 0)
        .toString(36);
    return `${placeId}_${hash}`;
}

export function validateRating(rating: number): boolean {
    return Number.isFinite(rating) && rating >= 1 && rating <= 5;
}

export function formatTimestamp(timestamp: string): string {
    try {
        return new Date(timestamp).toISOString();
    } catch {
        return new Date().toISOString();
    }
}

export function deduplicateReviews(reviews: any[], keyField: string = 'review_id'): any[] {
    const seen = new Set();
    return reviews.filter(review => {
        const key = review[keyField];
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
