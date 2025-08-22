#!/usr/bin/env node

import { runFromUrlFile, runQueue, OrchestrationOptions } from './index';
import { program } from 'commander';
import path from 'path';

program
  .name('argus-miner')
  .description('Argus Google Maps review miner using Playwright')
  .version('1.0.0');

program
  .command('mine')
  .description('Mine reviews from URLs')
  .option('-f, --file <file>', 'File containing URLs to process', 'places.txt')
  .option('-o, --output <file>', 'Output NDJSON file', 'reviews.ndjson')
  .option('-c, --concurrency <number>', 'Number of concurrent browsers', '1')
  .option('--headless', 'Run in headless mode', false)
  .option('--delay <ms>', 'Delay between URLs in milliseconds', '0')
  .option('--retries <number>', 'Number of retries per URL', '0')
  .option('--timeout <ms>', 'Page load timeout in milliseconds', '120000')
  .option('--block-images', 'Block image resources', false)
  .option('--block-videos', 'Block video resources', false)
  .option('--block-fonts', 'Block font resources', false)
  .action(async (options) => {
    const opts: OrchestrationOptions = {
      outputFile: path.resolve(options.output),
      concurrency: parseInt(options.concurrency, 10),
      headless: options.headless,
      delayBetweenUrls: parseInt(options.delay, 10),
      retries: parseInt(options.retries, 10),
      timeout: parseInt(options.timeout, 10),
      resourceBlocking: {
        images: options.blockImages,
        videos: options.blockVideos,
        fonts: options.blockFonts
      }
    };

    console.log('[CLI] Starting Argus miner with options:', opts);
    
    try {
      await runFromUrlFile(path.resolve(options.file), opts);
      console.log('[CLI] Mining completed successfully!');
    } catch (error) {
      console.error('[CLI] Mining failed:', error);
      process.exit(1);
    }
  });

program
  .command('mine-urls')
  .description('Mine reviews from specific URLs')
  .argument('<urls...>', 'URLs to process')
  .option('-o, --output <file>', 'Output NDJSON file', 'reviews.ndjson')
  .option('--headless', 'Run in headless mode', false)
  .option('--delay <ms>', 'Delay between URLs in milliseconds', '0')
  .option('--timeout <ms>', 'Page load timeout in milliseconds', '120000')
  .action(async (urls, options) => {
    const opts: OrchestrationOptions = {
      outputFile: path.resolve(options.output),
      headless: options.headless,
      delayBetweenUrls: parseInt(options.delay, 10),
      timeout: parseInt(options.timeout, 10)
    };

    console.log(`[CLI] Processing ${urls.length} URLs:`, urls);
    
    try {
      await runQueue(urls, opts);
      console.log('[CLI] Mining completed successfully!');
    } catch (error) {
      console.error('[CLI] Mining failed:', error);
      process.exit(1);
    }
  });

program.parse();
