export class ArgusExtractor {
    private isInitialized = false;

    constructor() {
        // Initialize extractor
    }

    public init(): void {
        if (this.isInitialized) return;
        
        this.setupEventListeners();
        this.isInitialized = true;
        console.log('Argus Extractor initialized');
    }

    private setupEventListeners(): void {
        // Listen for page changes
        const observer = new MutationObserver(() => {
            this.checkForReviews();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    private checkForReviews(): void {
        // Check if we're on a reviews page
        if (window.location.pathname.includes('/reviews')) {
            this.extractReviews();
        }
    }

    private extractReviews(): void {
        // Extract review data
        const reviews = document.querySelectorAll('[data-review-id]');
        const reviewData = Array.from(reviews).map(review => {
            return this.parseReview(review as HTMLElement);
        });

        if (reviewData.length > 0) {
            this.saveReviews(reviewData);
        }
    }

    private parseReview(element: HTMLElement): any {
        const reviewId = element.getAttribute('data-review-id');
        const author = element.querySelector('a')?.textContent?.trim();
        const rating = this.extractRating(element);
        const text = element.querySelector('[data-review-text]')?.textContent?.trim();
        const time = element.querySelector('span')?.textContent?.trim();

        return {
            review_id: reviewId,
            author,
            rating,
            text,
            time,
            extracted_at: new Date().toISOString()
        };
    }

    private extractRating(element: HTMLElement): number | null {
        const starElement = element.querySelector('[aria-label*="stars"]');
        if (starElement) {
            const ariaLabel = starElement.getAttribute('aria-label');
            const match = ariaLabel?.match(/(\d+(?:\.\d+)?)/);
            return match ? parseFloat(match[1]) : null;
        }
        return null;
    }

    private saveReviews(reviews: any[]): void {
        const data = {
            url: window.location.href,
            place_id: this.extractPlaceId(),
            reviews,
            extracted_at: new Date().toISOString()
        };

        // Save to GM storage
        GM_setValue('argus_reviews', JSON.stringify(data));
        
        // Download as JSON
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        GM_download({
            url,
            name: `argus_reviews_${Date.now()}.json`,
            onload: () => URL.revokeObjectURL(url)
        });
    }

    private extractPlaceId(): string | null {
        const match = window.location.pathname.match(/place\/([^\/]+)/);
        return match ? match[1] : null;
    }
}
