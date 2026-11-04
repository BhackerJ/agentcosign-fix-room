import {offerOutcome} from './offer-outcome.mjs';
import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';

const CHALLENGE = /verify you are human|verification challenge|too many requests/i;
const QUANTITY = 2;

// Fixed-task browser probe: two items, the advertised code once, read the cart. Viewport screenshots only,
// because a full-page capture closes the theme's Discount section.
export async function shopOffer(config, dir) {
  await mkdir(dir, {recursive: true});
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  let blocked = false;
  page.on('response', r => {
    if (r.status() === 429) blocked = true;
  });
  const checkAccess = async () => {
    if (blocked) throw Error('BLOCKED: HTTP 429');
    if (CHALLENGE.test(await page.locator('body').innerText()))
      throw Error('BLOCKED: verification challenge');
  };
  const productUrl = `https://${config.domain}/products/${config.handle}`;
  try {
    await page.goto(productUrl, {waitUntil: 'domcontentloaded'});
    if (page.url().includes('/password')) {
      await page.locator('input[name="password"]').fill(config.password);
      await page.locator('form[action*="password"]').getByRole('button').click();
      await page.waitForLoadState('domcontentloaded');
      await page.goto(productUrl, {waitUntil: 'domcontentloaded'});
    }
    await checkAccess();
    const advertised = (await page.locator('body').innerText())
      .split('\n')
      .find(text => text.includes(config.code));

    const form = page
      .locator(`form[action*="/cart/add"]:has(input[name="id"][value="${config.variant.split('/').at(-1)}"])`)
      .first();
    await form.locator('input[name="quantity"]').first().fill(String(QUANTITY));
    await form
      .getByRole('button', {name: /add to cart/i})
      .first()
      .click();
    await page.waitForTimeout(1500);
    await checkAccess();

    await page.goto(`https://${config.domain}/cart`, {waitUntil: 'domcontentloaded'});
    await checkAccess();
    await page.locator('summary', {hasText: 'Discount'}).first().click();
    await page
      .getByRole('textbox', {name: /discount/i})
      .first()
      .fill(config.code);
    await page
      .getByRole('button', {name: /^apply$/i})
      .first()
      .click();
    await page.waitForTimeout(2500);
    await checkAccess();
    const message =
      (await page.locator('body').innerText()).match(/discount code cannot be applied[^\n]*/i)?.[0] || '';
    await page.screenshot({path: dir + '/cart.png', fullPage: false});

    const response = await context.request.get(`https://${config.domain}/cart.js`);
    if (response.status() === 429) throw Error('BLOCKED: HTTP 429');
    if (!response.ok()) throw Error(`Cart HTTP ${response.status()}`);
    const cart = await response.json();
    const result = {
      kind: 'fixed-task-browser-probe',
      advertised: advertised || null,
      code: config.code,
      message,
      discount_codes: cart.discount_codes || [],
      items: cart.items.map(i => ({
        variant_id: String(i.variant_id),
        sku: i.sku,
        quantity: i.quantity,
        price: i.price,
        original_line_price: i.original_line_price,
        final_line_price: i.final_line_price,
        title: i.title,
      })),
      ...offerOutcome(cart, config.variant.split('/').at(-1), config.code, config.percentage, message),
    };
    await writeFile(dir + '/result.json', JSON.stringify(result, null, 2));
    return result;
  } finally {
    await context.close();
    await browser.close();
  }
}
