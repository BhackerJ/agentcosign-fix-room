// Judged from the same session's cart, never from the coupon's backend settings.
export function offerOutcome(cart, variant, code, percentage, message) {
  const line = cart.items.find(i => String(i.variant_id) === variant);
  const subtotal = line ? line.original_line_price : 0;
  const expectedDiscount = Math.round((subtotal * percentage) / 100);
  const applied = (cart.discount_codes || []).find(d => d.code.toUpperCase() === code.toUpperCase());
  const success =
    Boolean(line) &&
    line.quantity === 2 &&
    applied?.applicable === true &&
    cart.total_discount === expectedDiscount &&
    cart.items_subtotal_price === subtotal - expectedDiscount;
  return {
    success,
    unavailable: !success && /cannot be applied/i.test(message),
    subtotal_cents: subtotal,
    discount_cents: cart.total_discount,
    merchandise_after_discount_cents: cart.items_subtotal_price,
  };
}
