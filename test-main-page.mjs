import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));

console.log('Opening main page...\n');
await page.goto('http://127.0.0.1:5002/', { waitUntil: 'domcontentloaded' });

// Wait up to 90s for engine status to change from "loading..."
console.log('Waiting for engine to initialize...\n');
const start = Date.now();

while (Date.now() - start < 90000) {
  await new Promise(r => setTimeout(r, 2000));

  const status = await page.$eval('#engine-status', el => el.textContent).catch(() => 'not found');
  console.log(`  Engine status: "${status}"`);

  if (status.includes('ready') || status.includes('not available') || status.includes('timeout')) {
    break;
  }
}

// Take screenshot
await page.screenshot({ path: 'main-screenshot.png', fullPage: true });
console.log('\nScreenshot saved to main-screenshot.png');

// Get final status
const finalStatus = await page.$eval('#engine-status', el => el.textContent).catch(() => 'element not found');
console.log(`\nFinal engine status: "${finalStatus}"`);

await browser.close();
