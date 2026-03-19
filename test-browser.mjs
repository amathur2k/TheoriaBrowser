import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

// Collect console messages
const logs = [];
page.on('console', msg => {
  const text = msg.text();
  logs.push(text);
  console.log(`[${msg.type()}] ${text}`);
});
page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));

console.log('Opening test-engine.html...\n');
await page.goto('http://127.0.0.1:5002/test-engine.html', { waitUntil: 'domcontentloaded' });

// Wait up to 60s for engine ready or timeout
console.log('Waiting for engine messages (up to 60s)...\n');
const start = Date.now();
let engineReady = false;

while (Date.now() - start < 60000) {
  await new Promise(r => setTimeout(r, 1000));

  // Check the log element content
  const logContent = await page.$eval('#log', el => el.textContent);

  if (logContent.includes('ENGINE READY') || logContent.includes('uciok')) {
    engineReady = true;
    console.log('\n=== ENGINE READY! ===\n');
    break;
  }

  if (logContent.includes('TIMEOUT') || logContent.includes('[error]')) {
    console.log('\n=== DETECTED ERROR/TIMEOUT ===\n');
    break;
  }
}

// Get final log content
const finalLog = await page.$eval('#log', el => el.textContent);
console.log('--- Page Log Content ---');
console.log(finalLog);
console.log('--- End Log ---');

// Take a screenshot
await page.screenshot({ path: 'test-screenshot.png', fullPage: true });
console.log('\nScreenshot saved to test-screenshot.png');

await browser.close();
process.exit(engineReady ? 0 : 1);
