import { openAndMineWithOptions, PlaywrightOptions } from '../driver/playwright';
import { ReviewData } from '../miner/reviews';
import fs from 'fs';
import path from 'path';

export interface OrchestrationOptions extends PlaywrightOptions {
  outputFile?: string;
  concurrency?: number;
  retries?: number;
  delayBetweenUrls?: number;
}

export interface ReviewRecord extends ReviewData {
  place_url: string;
  place_id?: string;
  captured_at: string;
}

export async function runQueue(urls: string[], options: OrchestrationOptions = {}): Promise<void> {
  const outputFile = options.outputFile || path.join(process.cwd(), 'reviews.ndjson');
  const out = fs.createWriteStream(outputFile, { flags: 'a' });

  console.log(`[Orchestrator] Starting queue with ${urls.length} URLs`);
  console.log(`[Orchestrator] Output: ${outputFile}`);

  for (const url of urls) {
    console.log(`[Orchestrator] Processing: ${url}`);
    
    try {
      const reviews = await openAndMineWithOptions(url, async (page) => {
        // Inject the miner functionality directly
        const { runMinerLoop } = await import('../miner/reviews');
        const { SELS } = await import('../core/selectors');
        
        return await page.evaluate(async () => {
          // Simplified inline implementation to avoid complex type issues
          const SELS = {
            panel: ['.m6QErb','[role="feed"][aria-label*="review"]','div[aria-label*="All reviews"] .m6QErb'],
            reviewItem: ['div[data-review-id]','div[role="article"][data-review-id]','div[data-review-id][jsaction]'],
            moreBtn: ['button[jsaction*="more"]','span[role="button"][jsaction*="more"]','button[aria-label*="More"]','button[aria-label*="Xem thêm"]']
          };

          function qsAny(list: string[], root: any = document): any {
            for (const s of list) {
              const el = root.querySelector(s);
              if (el) return el;
            }
            return null;
          }

          function injectAntiIdleInPage(): void {
            if ((window as any).__ARGUS_SYNTH__) return;
            (window as any).__ARGUS_SYNTH__ = true;

            function fireAll(): void {
              try { document.dispatchEvent(new Event('visibilitychange')); } catch { }
              try { window.dispatchEvent(new Event('focus')); } catch { }
              try { window.dispatchEvent(new Event('pageshow', { bubbles: true } as any)); } catch { }
            }

            setInterval(fireAll, 2500);
            setTimeout(fireAll, 400);

            const c = document.createElement('canvas');
            c.width = 2;
            c.height = 2;
            Object.assign(c.style, {
              position: 'fixed', width: '2px', height: '2px', opacity: '0',
              pointerEvents: 'none', bottom: '0', right: '0'
            });

            const gl = c.getContext('webgl') as any || c.getContext('experimental-webgl') as any;
            if (gl) {
              document.documentElement.appendChild(c);
              setInterval(() => {
                try {
                  gl.clearColor(Math.random() % 1, 0, 0, 1);
                  gl.clear(gl.COLOR_BUFFER_BIT);
                } catch { }
              }, 1200);
            }
          }

          function ensureOpened(): boolean {
            const panel = qsAny(SELS.panel);
            const hasItems = document.querySelectorAll(SELS.reviewItem.join(',')).length > 0;
            if (panel && hasItems) return true;

            const more = qsAny(['button[role="tab"][aria-label*="Reviews" i]', 'a[href*="=reviews"]', 'div[role="tab"][aria-label*="Reviews" i]']);
            try {
              more?.scrollIntoView({ block: 'center' });
              more?.click();
            } catch { }

            try {
              (panel || document.scrollingElement || document.body).dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 320 }));
            } catch { }

            return false;
          }

          function clickMoreIfAny(root: any = document): void {
            const more = qsAny(['button[jsaction*="more"]', 'span[role="button"][jsaction*="more"]', 'button[aria-label*="More"]', 'button[aria-label*="Xem thêm"]'], root);
            try { more?.click(); } catch { }
          }

          function collectOnce(): any[] {
            const items = Array.from(document.querySelectorAll(SELS.reviewItem.join(',')));

            function txt(el: any, sel?: string): string {
              try {
                const n = sel ? el?.querySelector(sel) : el;
                return (n?.textContent || '').trim();
              } catch { return ''; }
            }

            function parseRating(root: any): number | null {
              const aria = root.querySelector('[aria-label*="star"]');
              const m = aria?.getAttribute('aria-label')?.match(/[\d.]+/);
              return m ? Number(m[0]) : null;
            }

            return items.map(el => {
              const rid = (el as any).getAttribute('data-review-id') || null;
              return {
                review_id: rid,
                author: txt(el, 'a[href*="contrib"], a[aria-label*="Profile"]') || null,
                relative_time: txt(el, 'span[aria-label*="ago"], span[data-original-text], .rsqaWe') || null,
                text: txt(el, 'span[jscontroller], span[class*="wiI7pd"], span[class*="MyEned"]') || '',
                rating: parseRating(el),
                translated: /Translated by Google/i.test((el as any).textContent || ''),
                likes: Number((txt(el, 'button[aria-label*="like" i], div[aria-label*="like" i]').match(/\d+/) || [0])[0]),
                photos: (el as any).querySelectorAll('img').length
              };
            });
          }

          async function runMinerLoop(rounds = 60): Promise<any[]> {
            injectAntiIdleInPage();
            let total = 0;

            for (let i = 0; i < rounds; i++) {
              ensureOpened();
              clickMoreIfAny(qsAny(SELS.panel) || document);

              const step = Math.max(200, Math.floor((qsAny(SELS.panel)?.clientHeight || 600) * 0.9));
              try { qsAny(SELS.panel)?.scrollBy(0, step); } catch { }

              await new Promise(r => setTimeout(r, 240));

              const now = document.querySelectorAll(SELS.reviewItem.join(',')).length;
              if (now > total) {
                total = now;
                (window as any).__ARGUS_EMIT__?.({ type: 'progress', url: location.href, count: total, ts: Date.now() });
              }
            }

            return collectOnce();
          }

          return await runMinerLoop(60);
        });
      }, options);

      // Write reviews to NDJSON
      for (const review of reviews) {
        const record: ReviewRecord = {
          place_url: url,
          place_id: extractPlaceId(url),
          captured_at: new Date().toISOString(),
          ...review
        };
        out.write(JSON.stringify(record) + '\n');
      }

      console.log(`[Orchestrator] Collected ${reviews.length} reviews from ${url}`);

      // Delay between URLs if specified
      if (options.delayBetweenUrls) {
        await new Promise(resolve => setTimeout(resolve, options.delayBetweenUrls));
      }
    } catch (error) {
      console.error(`[Orchestrator] Error processing ${url}:`, error);
      
      // Optionally retry
      if (options.retries && options.retries > 0) {
        console.log(`[Orchestrator] Retrying ${url}...`);
        // Implementation for retries would go here
      }
    }
  }

  out.end();
  console.log(`[Orchestrator] Queue completed. Output written to ${outputFile}`);
}

export async function runQueueWithConcurrency(
  urls: string[], 
  options: OrchestrationOptions = {}
): Promise<void> {
  const concurrency = options.concurrency || 3;
  const chunks: string[][] = [];
  
  // Split URLs into chunks for concurrent processing
  for (let i = 0; i < urls.length; i += concurrency) {
    chunks.push(urls.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(url => 
      runQueue([url], { ...options, concurrency: 1 })
    ));
  }
}

function extractPlaceId(url: string): string | undefined {
  const match = url.match(/place\/[^\/]+\/([^\/\?]+)/);
  return match ? match[1] : undefined;
}

export function parseUrlsFromFile(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.startsWith('http'));
  } catch (error) {
    console.error(`Error reading URLs from ${filePath}:`, error);
    return [];
  }
}

export async function runFromUrlFile(
  urlFilePath: string, 
  options: OrchestrationOptions = {}
): Promise<void> {
  const urls = parseUrlsFromFile(urlFilePath);
  console.log(`[Orchestrator] Loaded ${urls.length} URLs from ${urlFilePath}`);
  
  if (options.concurrency && options.concurrency > 1) {
    await runQueueWithConcurrency(urls, options);
  } else {
    await runQueue(urls, options);
  }
}
