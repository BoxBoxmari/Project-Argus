/**
 * Resource blocking for performance optimization
 * Enhanced version based on userscript optimization techniques
 */

export interface BlocklistConfig {
    blockImages: boolean;
    blockFonts: boolean;
    blockMedia: boolean;
    blockAds: boolean;
    blockAnalytics: boolean;
    allowCriticalImages: boolean;
    allowCriticalCSS: boolean;
    customPatterns: RegExp[];
}

export const DEFAULT_BLOCKLIST_CONFIG: BlocklistConfig = {
    blockImages: true,
    blockFonts: true,
    blockMedia: true,
    blockAds: true,
    blockAnalytics: true,
    allowCriticalImages: true,
    allowCriticalCSS: true,
    customPatterns: []
};

// Resource types to block for performance
const BLOCKED_RESOURCE_TYPES = new Set([
    'image',
    'font',
    'media',
    'other' // Catch-all for misc resources
]);

// URL patterns for ads and analytics (from userscript experience)
const AD_PATTERNS = [
    /doubleclick\.net/i,
    /googleadservices/i,
    /googlesyndication/i,
    /adsystem/i,
    /amazon-adsystem/i,
    /facebook\.com\/tr/i,
    /analytics\.google/i,
    /google-analytics/i,
    /googletagmanager/i,
    /hotjar/i,
    /mixpanel/i,
    /segment\.(io|com)/i
];

// Critical image patterns to allow (profile pics, map tiles, etc.)
const CRITICAL_IMAGE_PATTERNS = [
    /maps\.googleapis\.com/i,
    /\/maps\/api\//i,
    /profile.*\.(jpg|jpeg|png|gif|webp)/i,
    /avatar.*\.(jpg|jpeg|png|gif|webp)/i,
    /user.*\.(jpg|jpeg|png|gif|webp)/i,
    /=s\d+/i, // Google profile image resize parameter
];

// Critical CSS patterns to allow
const CRITICAL_CSS_PATTERNS = [
    /maps\.googleapis\.com/i,
    /fonts\.googleapis\.com/i,
    /gstatic\.com.*\.css/i
];

/**
 * Install resource blocklist on a Playwright page
 */
export async function installBlocklist(page: any, config: Partial<BlocklistConfig> = {}): Promise<void> {
    const finalConfig = { ...DEFAULT_BLOCKLIST_CONFIG, ...config };

    console.log('[blocklist] Installing resource blocklist...');

    let blockedCount = 0;
    let allowedCount = 0;

    await page.route('**/*', (route: any) => {
        const request = route.request();
        const url = request.url();
        const resourceType = request.resourceType();

        // Check if should block this resource
        if (shouldBlockResource(url, resourceType, finalConfig)) {
            blockedCount++;
            if (blockedCount % 50 === 0) {
                console.log(`[blocklist] Blocked ${blockedCount} resources so far`);
            }
            return route.abort();
        } else {
            allowedCount++;
            return route.continue();
        }
    });

    // Log stats periodically
    setTimeout(() => {
        console.log(`[blocklist] Stats - Blocked: ${blockedCount}, Allowed: ${allowedCount}`);
    }, 10000);
}

/**
 * Determine if a resource should be blocked
 */
function shouldBlockResource(url: string, resourceType: string, config: BlocklistConfig): boolean {
    // Always block ads and analytics
    if (config.blockAds || config.blockAnalytics) {
        for (const pattern of AD_PATTERNS) {
            if (pattern.test(url)) {
                return true;
            }
        }
    }

    // Check custom patterns
    for (const pattern of config.customPatterns) {
        if (pattern.test(url)) {
            return true;
        }
    }

    // Handle specific resource types
    switch (resourceType) {
        case 'image':
            if (!config.blockImages) return false;

            // Allow critical images if configured
            if (config.allowCriticalImages) {
                for (const pattern of CRITICAL_IMAGE_PATTERNS) {
                    if (pattern.test(url)) {
                        return false;
                    }
                }
            }
            return true;

        case 'font':
            return config.blockFonts;

        case 'media':
            return config.blockMedia;

        case 'stylesheet':
            if (!config.allowCriticalCSS) return false;

            // Allow critical CSS
            for (const pattern of CRITICAL_CSS_PATTERNS) {
                if (pattern.test(url)) {
                    return false;
                }
            }
            // Block non-critical CSS if images are blocked (performance mode)
            return config.blockImages;

        default:
            return BLOCKED_RESOURCE_TYPES.has(resourceType);
    }
}

/**
 * Environment-aware blocklist configuration
 */
export function getOptimalConfig(environment: 'development' | 'production' | 'testing' = 'production'): BlocklistConfig {
    switch (environment) {
        case 'development':
            return {
                ...DEFAULT_BLOCKLIST_CONFIG,
                blockImages: false, // Allow images for debugging
                allowCriticalCSS: true
            };

        case 'testing':
            return {
                ...DEFAULT_BLOCKLIST_CONFIG,
                blockImages: true,
                blockFonts: true,
                blockMedia: true,
                allowCriticalImages: false // Block everything for maximum speed
            };

        case 'production':
        default:
            return DEFAULT_BLOCKLIST_CONFIG;
    }
}

/**
 * Apply blocklist based on environment variables
 */
export async function installEnvironmentBlocklist(page: any): Promise<void> {
    const blockResources = process.env.ARGUS_BLOCK_RESOURCES !== '0'; // Default to true
    const allowMedia = process.env.ARGUS_ALLOW_MEDIA === '1';
    const allowImages = process.env.ARGUS_ALLOW_IMAGES === '1';
    const environment = process.env.NODE_ENV as 'development' | 'production' | 'testing' || 'production';

    if (!blockResources) {
        console.log('[blocklist] Resource blocking disabled via ARGUS_BLOCK_RESOURCES=0');
        return;
    }

    const baseConfig = getOptimalConfig(environment);
    const config: BlocklistConfig = {
        ...baseConfig,
        blockMedia: !allowMedia && baseConfig.blockMedia,
        blockImages: !allowImages && baseConfig.blockImages
    };

    await installBlocklist(page, config);

    console.log(`[blocklist] Environment: ${environment}, Images: ${!config.blockImages}, Media: ${!config.blockMedia}`);
}

/**
 * Get blocklist statistics from a page
 */
export async function getBlocklistStats(page: any): Promise<{ blocked: number; allowed: number }> {
    try {
        // This would require instrumenting the route handler to track stats
        // For now, return placeholder
        return { blocked: 0, allowed: 0 };
    } catch (e) {
        console.warn('[blocklist] Could not get stats:', e);
        return { blocked: 0, allowed: 0 };
    }
}