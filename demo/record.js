/**
 * TableTap – Full app screen recorder
 * Records every flow in iPhone 14 viewport (390×844), then saves raw clips
 * that ffmpeg will assemble into the final reel.
 *
 * Usage: node record.js
 * Output: ./clips/  (one .webm per flow)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL   = 'http://localhost:3000';
const TOKEN      = '0898ec3ba977';          // woodpecker-cafe Table 3
const SLUG       = 'woodpecker-cafe';
const EMAIL      = 'owner@woodpeckercafe.in';
const PASSWORD   = 'demo1234';

const CLIPS_DIR  = path.join(__dirname, 'clips');
fs.mkdirSync(CLIPS_DIR, { recursive: true });

// iPhone 14 Pro viewport
const VIEWPORT   = { width: 390, height: 844 };

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Simulate a human tap with a visible ripple overlay */
async function tap(page, selector, opts = {}) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 8000 });
  await el.scrollIntoViewIfNeeded();
  await sleep(300);
  await el.click(opts);
  await sleep(400);
}

/** Scroll the page by deltaY pixels */
async function scroll(page, deltaY, steps = 3) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, deltaY / steps);
    await sleep(200);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIP 1 – Customer flow: menu → cart → checkout → cash payment → success
// ─────────────────────────────────────────────────────────────────────────────
async function recordCustomerFlow(browser) {
  console.log('[1/4] Recording customer flow…');
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: CLIPS_DIR, size: VIEWPORT },
    colorScheme: 'light',
  });

  const page = await ctx.newPage();
  try {
    // 1a. Land on storefront
    await page.goto(`${BASE_URL}/r/${SLUG}/t/${TOKEN}`, { waitUntil: 'networkidle' });
    await sleep(2500); // let the hero render

    // 1b. Scroll down – show category tabs & items
    await scroll(page, 300, 4);
    await sleep(1200);

    // 1c. Click "Chef's Specials" first item Add button
    await tap(page, 'button:has-text("Add"):nth-of-type(1)');
    await sleep(600);

    // 1d. Tap the first item again (qty → 2)
    await tap(page, 'button[aria-label="Increase quantity"]:first-of-type, button:has-text("+"):first-of-type');
    await sleep(600);

    // 1e. Scroll to show a second category – tap Pizza tab
    await tap(page, 'button:has-text("Pizza"), [role="tab"]:has-text("Pizza")');
    await sleep(1000);

    // 1f. Add a pizza
    await tap(page, 'button:has-text("Add"):nth-of-type(1)');
    await sleep(800);

    // 1g. Scroll to Cold Beverages tab → add one item
    await tap(page, 'button:has-text("Cold"), [role="tab"]:has-text("Cold")');
    await sleep(800);
    await tap(page, 'button:has-text("Add"):nth-of-type(1)');
    await sleep(800);

    // 1h. Scroll back to top to show cart summary / checkout button
    await scroll(page, -800, 5);
    await sleep(1000);

    // 1i. Click Checkout / View Cart / Review Order button
    await tap(page, 'a[href*="checkout"], button:has-text("Review"), button:has-text("Checkout"), button:has-text("View cart")');
    await sleep(2000);

    // 1j. Checkout page – scroll to show order summary
    await scroll(page, 200, 3);
    await sleep(1500);

    // 1k. Tap "Pay at counter (Cash)"
    await tap(page, 'button:has-text("Cash"), button:has-text("counter")');
    await sleep(2500);

    // 1l. Success screen – hold for 3s
    await sleep(3000);

  } catch (err) {
    console.warn('  Customer flow warning:', err.message);
  }

  const video = await page.video();
  await ctx.close();
  if (video) {
    const src = await video.path();
    const dest = path.join(CLIPS_DIR, 'clip1_customer.webm');
    fs.renameSync(src, dest);
    console.log('  Saved:', dest);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIP 2 – Dashboard: login → live orders board → new order notification
// ─────────────────────────────────────────────────────────────────────────────
async function recordDashboardFlow(browser) {
  console.log('[2/4] Recording dashboard flow…');
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: CLIPS_DIR, size: VIEWPORT },
  });

  const page = await ctx.newPage();
  try {
    // Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await sleep(1500);

    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await sleep(400);
    await page.fill('input[type="password"], input[name="password"]', PASSWORD);
    await sleep(400);
    await tap(page, 'button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    await sleep(2000);

    // Dashboard overview – let it render
    await sleep(1500);
    await scroll(page, 200, 3);
    await sleep(1000);

    // Navigate to Orders
    await tap(page, 'a[href*="orders"], nav a:has-text("Orders")');
    await sleep(2500);

    // Scroll through orders
    await scroll(page, 300, 4);
    await sleep(1500);

    // Scroll back up – show the pending badge
    await scroll(page, -400, 4);
    await sleep(2000);

    // Hold on orders board for 3s
    await sleep(3000);

  } catch (err) {
    console.warn('  Dashboard flow warning:', err.message);
  }

  const video = await page.video();
  await ctx.close();
  if (video) {
    const src = await video.path();
    const dest = path.join(CLIPS_DIR, 'clip2_dashboard.webm');
    fs.renameSync(src, dest);
    console.log('  Saved:', dest);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIP 3 – Insights: revenue, heatmap, bestsellers (the main USP)
// ─────────────────────────────────────────────────────────────────────────────
async function recordInsightsFlow(browser) {
  console.log('[3/4] Recording insights flow…');
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: CLIPS_DIR, size: VIEWPORT },
  });

  const page = await ctx.newPage();
  try {
    // Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await sleep(1000);
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"], input[name="password"]', PASSWORD);
    await tap(page, 'button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    await sleep(1500);

    // Navigate directly to insights
    await page.goto(`${BASE_URL}/dashboard/insights`, { waitUntil: 'networkidle' });
    await sleep(2500);

    // Hold on the KPI cards (revenue, orders, avg)
    await sleep(2000);

    // Scroll down – show charts
    await scroll(page, 350, 5);
    await sleep(2000);

    // Scroll further – show heatmap
    await scroll(page, 350, 5);
    await sleep(2500);

    // Scroll further – show bestsellers list
    await scroll(page, 350, 5);
    await sleep(2500);

    // Scroll back to top to end on the overview
    await scroll(page, -1200, 8);
    await sleep(2000);

  } catch (err) {
    console.warn('  Insights flow warning:', err.message);
  }

  const video = await page.video();
  await ctx.close();
  if (video) {
    const src = await video.path();
    const dest = path.join(CLIPS_DIR, 'clip3_insights.webm');
    fs.renameSync(src, dest);
    console.log('  Saved:', dest);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIP 4 – QR landing: show how QR scan drops you on the menu instantly
//           (re-open storefront URL fresh, no prior state)
// ─────────────────────────────────────────────────────────────────────────────
async function recordQRLanding(browser) {
  console.log('[4/4] Recording QR landing flow…');
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: CLIPS_DIR, size: VIEWPORT },
    colorScheme: 'light',
  });

  const page = await ctx.newPage();
  try {
    // Navigate fresh – simulates scanning QR code
    await page.goto(`${BASE_URL}/r/${SLUG}/t/${TOKEN}`, { waitUntil: 'networkidle' });
    await sleep(3000); // let it breathe

    // Slow scroll to reveal full category list
    await scroll(page, 150, 3);
    await sleep(1000);
    await scroll(page, 150, 3);
    await sleep(1000);
    await scroll(page, 150, 3);
    await sleep(1500);

    // Tap a category tab (Sushi if visible)
    try {
      await tap(page, '[role="tab"]:has-text("Sushi"), button:has-text("Sushi")');
      await sleep(1500);
    } catch (_) {}

    // Scroll through items
    await scroll(page, 300, 4);
    await sleep(2000);

    // Scroll back to top
    await scroll(page, -800, 6);
    await sleep(2000);

  } catch (err) {
    console.warn('  QR landing warning:', err.message);
  }

  const video = await page.video();
  await ctx.close();
  if (video) {
    const src = await video.path();
    const dest = path.join(CLIPS_DIR, 'clip4_qr.webm');
    fs.renameSync(src, dest);
    console.log('  Saved:', dest);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    await recordQRLanding(browser);
    await recordCustomerFlow(browser);
    await recordDashboardFlow(browser);
    await recordInsightsFlow(browser);
  } finally {
    await browser.close();
  }

  console.log('\n✅ All clips recorded in', CLIPS_DIR);
  console.log('   Run:  node compile.js   to assemble the final MP4');
})();
