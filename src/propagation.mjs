import {request} from 'playwright';
// Separate observer: expected stock state is never passed to the shopper.
export async function waitForStorefront(config, available) {
  const context = await request.newContext();
  try {
    if (config.password) {
      const login = await context.post(`https://${config.domain}/password`, {
        form: {password: config.password, form_type: 'storefront_password'},
      });
      if (login.status() === 429) throw Error('BLOCKED: HTTP 429');
      if (!login.ok()) throw Error(`Storefront login HTTP ${login.status()}`);
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      const response = await context.get(`https://${config.domain}/products/${config.handle}.js`);
      if (response.status() === 429) throw Error('BLOCKED: HTTP 429');
      if (!response.ok()) throw Error(`Storefront product HTTP ${response.status()}`);
      const product = await response.json();
      const variant = product.variants.find(v => String(v.id) === config.variant.split('/').at(-1));
      if (!variant) throw Error('Storefront variant mapping missing');
      if (variant.available === available) return {attempts: attempt + 1, available: variant.available};
      if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 10000));
    }
    throw Error('Storefront propagation not confirmed within 50 seconds; applied but not verified');
  } finally {
    await context.dispose();
  }
}

// A coupon has no public availability flag, so only a fresh cart can show the change has reached the storefront.
export async function waitForCoupon(check, accepted, {attempts = 3, delay = 10000} = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = await check(attempt);
    if (result.success === accepted) return {attempts: attempt + 1, accepted};
    if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw Error('Coupon change not confirmed in a fresh cart; applied but not verified');
}
