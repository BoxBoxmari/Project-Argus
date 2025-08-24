import { chromium, Browser, Page } from 'playwright';

export class ArgusScraper {
    private browser: Browser | null = null;
    private page: Page | null = null;

    async init(): Promise<void> {
        this.browser = await chromium.launch({ headless: true });
        this.page = await this.browser.newPage();
        
        // Set user agent and viewport
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await this.page.setViewportSize({ width: 1280, height: 720 });
    }

    async scrapeReviews(placeUrl: string): Promise<any[]> {
        if (!this.page) throw new Error('Scraper not initialized');

        try {
            await this.page.goto(placeUrl, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(2000);

            // Navigate to reviews
            await this.navigateToReviews();
            
            // Extract reviews
            const reviews = await this.extractReviews();
            
            return reviews;
        } catch (error) {
            console.error('Error scraping reviews:', error);
            return [];
        }
    }

    private async navigateToReviews(): Promise<void> {
        if (!this.page) return;

        // Try to click reviews tab
        const reviewsTab = await this.page.locator('button[role="tab"][aria-label*="Reviews"]').first();
        if (await reviewsTab.isVisible()) {
            await reviewsTab.click();
            await this.page.waitForTimeout(1000);
        } else {
            // Fallback: navigate directly to reviews URL
            const currentUrl = this.page.url();
            const reviewsUrl = currentUrl.replace(/\/data\![^?]+/, '/reviews');
            await this.page.goto(reviewsUrl + 'hl=en&entry=ttu');
            await this.page.waitForTimeout(2000);
        }
    }

    private async extractReviews(): Promise<any[]> {
        if (!this.page) return [];

        const reviews: any[] = [];
        let previousCount = 0;
        let scrollAttempts = 0;
        const maxScrolls = 50;

        while (scrollAttempts < maxScrolls) {
            // Find review elements
            const reviewElements = await this.page.locator('[data-review-id]').all();
            
            for (const element of reviewElements) {
                const reviewData = await this.parseReviewElement(element);
                if (reviewData && !reviews.find(r => r.review_id === reviewData.review_id)) {
                    reviews.push(reviewData);
                }
            }

            // Scroll to load more
            const scrollBox = await this.page.locator('div.m6QErb.DxyBCb.kA9KIf.dS8AEf').first();
            if (await scrollBox.isVisible()) {
                await scrollBox.evaluate(el => el.scrollBy(0, el.clientHeight * 0.8));
                await this.page.waitForTimeout(1000);
            }

            // Check if we're still loading new reviews
            if (reviews.length === previousCount) {
                scrollAttempts++;
            } else {
                previousCount = reviews.length;
                scrollAttempts = 0;
            }
        }

        return reviews;
    }

    private async parseReviewElement(element: any): Promise<any> {
        try {
            const reviewId = await element.getAttribute('data-review-id');
            const author = await element.locator('a').first().textContent() || '';
            const rating = await this.extractRating(element);
            const text = await element.locator('[data-review-text]').textContent() || '';
            const time = await element.locator('span').first().textContent() || '';

            return {
                review_id: reviewId,
                author: author.trim(),
                rating,
                text: text.trim(),
                time: time.trim(),
                extracted_at: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error parsing review element:', error);
            return null;
        }
    }

    private async extractRating(element: any): Promise<number | null> {
        try {
            const starElement = await element.locator('[aria-label*="stars"]').first();
            if (await starElement.isVisible()) {
                const ariaLabel = await starElement.getAttribute('aria-label');
                const match = ariaLabel?.match(/(\d+(?:\.\d+)?)/);
                return match ? parseFloat(match[1]) : null;
            }
        } catch (error) {
            // Rating extraction failed
        }
        return null;
    }

    async close(): Promise<void> {
        if (this.page) await this.page.close();
        if (this.browser) await this.browser.close();
    }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const scraper = new ArgusScraper();
    
    async function main() {
        try {
            await scraper.init();
            const placeUrl = process.argv[2] || 'https://www.google.com/maps/place/Highlands+Coffee+417+Dien+Bien+Phu/';
            const reviews = await scraper.scrapeReviews(placeUrl);
            
            console.log(JSON.stringify({
                url: placeUrl,
                reviews_count: reviews.length,
                reviews,
                extracted_at: new Date().toISOString()
            }, null, 2));
        } catch (error) {
            console.error('Scraping failed:', error);
            process.exit(1);
        } finally {
            await scraper.close();
        }
    }

    main();
}
