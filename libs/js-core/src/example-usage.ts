/* moved out of build: keep as example only. See tsconfig exclude. */
import { ScraperOrchestrator, BaseScraper, ScraperOptions } from './scraper-orchestrator';
import { RequestQueue, Req } from './request-queue';
import { AutoscaledPool } from './autoscale';
import { retry, retryWithStrategy, retryStrategies } from './retry';
import { extractDomain } from './domain-utils';

// Example: Google Maps Reviews Scraper
class GoogleMapsScraper extends BaseScraper {
  async scrape(url: string): Promise<any> {
    // Simulate scraping Google Maps reviews
    console.log(`Scraping: ${url}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Simulate occasional failures
    if (Math.random() < 0.1) {
      throw new Error('429 Too Many Requests');
    }
    
    // Return mock review data
    return {
      place_id: url.split('/').pop(),
      reviews: [
        {
          author: 'User 1',
          rating: 5,
          text: 'Great place!',
          timestamp: new Date().toISOString()
        },
        {
          author: 'User 2',
          rating: 4,
          text: 'Good experience',
          timestamp: new Date().toISOString()
        }
      ],
      total_reviews: 2,
      scraped_at: new Date().toISOString()
    };
  }

  getDomain(): string {
    return 'maps.google.com';
  }
}

// Example: Advanced Queue Management
async function demonstrateQueueFeatures() {
  console.log('=== Queue Management Demo ===');
  
  const queue = new RequestQueue('./data/queue.ndjson');
  await queue.init();

  // Add URLs with different priorities
  const urls = [
    'https://maps.google.com/place/restaurant1',
    'https://maps.google.com/place/restaurant2',
    'https://maps.google.com/place/restaurant3',
    'https://maps.google.com/place/restaurant4'
  ];

  for (let i = 0; i < urls.length; i++) {
    const req: Req = {
      url: urls[i],
      priority: urls.length - i, // Higher priority for earlier URLs
      domain: extractDomain(urls[i]),
      uniqueKey: `restaurant-${i + 1}`,
      userData: { category: 'restaurant', city: 'Hanoi' }
    };
    
    await queue.add(req);
    console.log(`Added: ${urls[i]} with priority ${req.priority}`);
  }

  // Process items
  let processed = 0;
  while (processed < urls.length) {
    const item = await queue.fetchNext();
    if (!item) break;

    console.log(`Processing: ${item.url} (priority: ${item.priority})`);
    
    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 500));
      await queue.markHandled(item.id);
      console.log(`✓ Completed: ${item.url}`);
    } catch (error) {
      await queue.markFailed(item.id, error instanceof Error ? error.message : String(error));
      console.log(`✗ Failed: ${item.url}`);
    }
    
    processed++;
  }

  // Show final stats
  const stats = queue.getStats();
  console.log('Final Queue Stats:', stats);
  
  await queue.close();
}

// Example: Autoscaling Pool
async function demonstrateAutoscaling() {
  console.log('\n=== Autoscaling Pool Demo ===');
  
  let taskCount = 0;
  const pool = new AutoscaledPool({
    minConcurrency: 2,
    maxConcurrency: 5,
    maybeRunIntervalMs: 200,
    cpuThreshold: 0.7,
    eventLoopThreshold: 30
  }, async () => {
    taskCount++;
    console.log(`Task ${taskCount} started`);
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    console.log(`Task ${taskCount} completed`);
  });

  await pool.start();
  
  // Let it run for a bit
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const stats = pool.getStats();
  console.log('Pool Stats:', stats);
  
  pool.stop();
}

// Example: Retry Mechanisms
async function demonstrateRetryMechanisms() {
  console.log('\n=== Retry Mechanisms Demo ===');
  
  // Simulate a flaky API
  const flakyApi = async (): Promise<string> => {
    if (Math.random() < 0.7) {
      throw new Error('429 Too Many Requests');
    }
    return 'Success!';
  };

  try {
    const result = await retryWithStrategy(flakyApi, 'rateLimit');
    console.log('API call succeeded:', result);
  } catch (error) {
    console.log('API call failed after retries:', error instanceof Error ? error.message : String(error));
  }

  // Custom retry strategy
  const customRetry = async (): Promise<string> => {
    if (Math.random() < 0.5) {
      throw new Error('Network timeout');
    }
    return 'Data retrieved!';
  };

  try {
    const result = await retry(customRetry, {
      retries: 3,
      baseMs: 100,
      capMs: 1000,
      jitter: 0.3,
      onRetry: (attempt: number, error: Error, delay: number) => {
        console.log(`Retry ${attempt}: ${error.message}, waiting ${delay}ms`);
      }
    });
    console.log('Custom retry succeeded:', result);
  } catch (error) {
    console.log('Custom retry failed:', error instanceof Error ? error.message : String(error));
  }
}

// Example: Full Scraper Orchestrator
async function demonstrateFullOrchestrator() {
  console.log('\n=== Full Scraper Orchestrator Demo ===');
  
  const options: ScraperOptions = {
    queueFile: './data/scraper-queue.ndjson',
    outputFile: './data/scraping-results.ndjson',
    logFile: './data/scraper.log',
    minConcurrency: 2,
    maxConcurrency: 4,
    maxRetries: 3,
    rateLimitDelay: 1000
  };

  const scraper = new GoogleMapsScraper();
  const orchestrator = new ScraperOrchestrator(options, scraper);

  await orchestrator.init();

  // Add URLs to scrape
  const urls = [
    'https://maps.google.com/place/restaurant-a',
    'https://maps.google.com/place/restaurant-b',
    'https://maps.google.com/place/restaurant-c',
    'https://maps.google.com/place/restaurant-d',
    'https://maps.google.com/place/restaurant-e'
  ];

  await orchestrator.addUrls(urls, 5);

  // Let it run for a bit
  console.log('Orchestrator running...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Get stats
  const stats = await orchestrator.getStats();
  console.log('Orchestrator Stats:', stats);

  // Stop the orchestrator
  await orchestrator.stop();
}

// Main demo function
async function runAllDemos() {
  try {
    await demonstrateQueueFeatures();
    await demonstrateAutoscaling();
    await demonstrateRetryMechanisms();
    await demonstrateFullOrchestrator();
    
    console.log('\n=== All Demos Completed Successfully ===');
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

// Export for use in other modules
export {
  GoogleMapsScraper,
  demonstrateQueueFeatures,
  demonstrateAutoscaling,
  demonstrateRetryMechanisms,
  demonstrateFullOrchestrator,
  runAllDemos
};

// Run demos if this file is executed directly
if (require.main === module) {
  runAllDemos();
}
