const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 800 });

  // Login
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
  await page.fill('input[type="email"], input[name="email"]', 'admin@nexgentms.com');
  await page.fill('input[type="password"]', 'Admin@1234');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ timeout: 10000 });

  // Go to loads
  await page.goto('http://localhost:3000/loads');
  await page.waitForSelector('table', { timeout: 10000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'C:/Rajan_Project/NexGen_TMS/loads-screenshot.png', fullPage: false });
  console.log('Screenshot saved');
  await browser.close();
})();
