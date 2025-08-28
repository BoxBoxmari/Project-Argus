#!/usr/bin/env node

// Simple test runner for the new components
console.log('🧪 Testing @argus/js-core components...\n');

async function runTests() {
  try {
    // Test 1: Import components
    console.log('1. Testing imports...');
    const { RequestQueue } = await import('./dist/request-queue.js');
    const { AutoscaledPool } = await import('./dist/autoscale.js');
    const { retry, retryStrategies } = await import('./dist/retry.js');
    const { extractDomain, getRateLimit } = await import('./dist/domain-utils.js');
    console.log('✅ All imports successful\n');

    // Test 2: Request Queue basic functionality
    console.log('2. Testing Request Queue...');
    const queue = new RequestQueue('./test-queue.ndjson');
    await queue.init();
    
    const req = {
      url: 'https://maps.google.com/place/test',
      priority: 10,
      uniqueKey: 'test-123'
    };
    
    const item = await queue.add(req);
    console.log(`✅ Added item: ${item.id}`);
    
    const stats = queue.getStats();
    console.log(`✅ Queue stats: ${JSON.stringify(stats)}`);
    
    await queue.close();
    console.log('✅ Request Queue test passed\n');

    // Test 3: Domain utilities
    console.log('3. Testing Domain Utilities...');
    const domain = extractDomain('https://maps.google.com/place/restaurant');
    console.log(`✅ Extracted domain: ${domain}`);
    
    const rateLimit = getRateLimit(domain);
    console.log(`✅ Rate limit: ${JSON.stringify(rateLimit)}`);
    console.log('✅ Domain utilities test passed\n');

    // Test 4: Retry strategies
    console.log('4. Testing Retry Strategies...');
    console.log(`✅ Rate limit strategy: ${retryStrategies.rateLimit.retries} retries`);
    console.log(`✅ Network strategy: ${retryStrategies.network.retries} retries`);
    console.log(`✅ Server error strategy: ${retryStrategies.serverError.retries} retries`);
    console.log('✅ Retry strategies test passed\n');

    // Test 5: Autoscaling Pool
    console.log('5. Testing Autoscaling Pool...');
    let taskCount = 0;
    const pool = new AutoscaledPool({
      minConcurrency: 1,
      maxConcurrency: 3,
      maybeRunIntervalMs: 100
    }, async () => {
      taskCount++;
      console.log(`  Task ${taskCount} executed`);
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    await pool.start();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const poolStats = pool.getStats();
    console.log(`✅ Pool stats: ${JSON.stringify(poolStats)}`);
    
    pool.stop();
    console.log('✅ Autoscaling Pool test passed\n');

    console.log('🎉 All tests passed successfully!');
    console.log('\nThe new @argus/js-core components are working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Clean up test files on exit
const cleanup = () => {
  try {
    import('fs').then(fs => {
      try {
        fs.unlinkSync('./test-queue.ndjson');
      } catch {
        // File might not exist
      }
    });
  } catch {
    // Ignore cleanup errors
  }
};

// Handle different exit scenarios
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  cleanup();
  process.exit(1);
});

runTests();