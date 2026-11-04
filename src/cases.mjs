// What differs between case modes: which resource they change and how the room and card describe it.
export const COUPON_FAULT_MINIMUM = 50;

export const isPromotion = c => c.mode === 'promotion' || c.mode === 'promotion-reset';
export const isReset = c => c.mode === 'reset' || c.mode === 'promotion-reset';
const dollars = cents => `$${(cents / 100).toFixed(2)}`;

export function currentValue(c) {
  return isPromotion(c) ? c.before.minimum : c.before.item.inventoryLevel.quantities[0].quantity;
}

export function validateTarget(c) {
  if (isPromotion(c)) {
    if (c.mode === 'promotion-reset' && c.target !== COUPON_FAULT_MINIMUM)
      throw Error(`Coupon reset minimum must be ${COUPON_FAULT_MINIMUM}`);
    if (!Number.isSafeInteger(c.target) || c.target < 1 || c.target > 100)
      throw Error('Coupon minimum must be $1–$100');
    return;
  }
  if (c.mode === 'reset' && c.target !== 0) throw Error('Reset quantity must be 0');
  if (!Number.isSafeInteger(c.target) || c.target < 0 || c.target > 100)
    throw Error('Quantity must be 0–100');
}

export function resultOf(c) {
  if (isReset(c)) return c.retest.unavailable ? 'reset_verified' : 'reset_not_verified';
  if (!c.retest.success) return 'not_improved';
  return c.baseline.success ? 'purchasable_before_and_after' : 'improved';
}

const inventory = c => ({
  sending:
    'I am sending the shopping agent to try buying one towel. Its browser actions and outcome will be recorded, then checked independently.',
  askFact:
    c.mode === 'reset'
      ? 'What quantity should the simulated test inventory be reset to?'
      : 'How many sellable units are in the warehouse? For example: "The warehouse has 25 units."',
  handoff: 'The merchant confirmed the quantity. Please prepare the repair proposal.',
  noChange: 'Store inventory already matches the confirmed quantity. No change is needed.',
  preparing: 'Preparing the inventory proposal. Approval buttons will appear shortly.',
  applied:
    'Inventory read-back confirmed. Waiting for the storefront to update, then testing Add to cart again.',
  cardTitle: c.mode === 'reset' ? 'Test inventory reset proposal' : 'Restock proposal',
  cardChange: `Change **Demo Hand Towel** available inventory from **${c.before ? currentValue(c) : '?'} units** to **${c.target} units**. Price and product options stay the same.`,
  approveLabel:
    c.mode === 'reset' ? `Approve reset to ${c.target} units` : `Approve restock to ${c.target} units`,
  afterApproval:
    'After approval, inventory will be updated, storefront propagation checked, and a fresh shopping session tested.',
  processed:
    'This proposal has been processed. Repeated clicks only show status and never repeat the inventory change.',
  cancelled: 'Cancelled. No inventory change.',
  cancelledNotice: 'Cancelled. Inventory will not be changed.',
  approvedNotice:
    'Approval received. Updating inventory and verifying; the result will appear on this card automatically.',
  completed: `**${c.mode === 'reset' ? 'Test inventory reset' : 'Restock'} completed: inventory is ${c.target} units.**\n${c.mode === 'reset' ? 'Storefront confirmed sold out; the fresh cart is empty.' : 'Storefront confirmed available; a fresh shopping session added 1 item.'}`,
  writtenNotVerified: `**Inventory is now ${c.target} units, but verification did not finish.**`,
  notApplied: '**Not applied: inventory changed after this proposal.**\nNo inventory write was sent.',
  checkCurrent: 'Check current inventory before starting a new request.',
  verdict:
    c.mode === 'reset'
      ? c.retest?.unavailable
        ? 'Test inventory reset verified: the product is sold out and the fresh cart is empty.'
        : 'Inventory changed, but the sold-out storefront state has not been verified.'
      : c.retest?.success
        ? `Verification passed: inventory is ${c.target} units and a fresh shopping session added 1 item. No checkout or payment.`
        : 'Inventory changed, but Add to cart failed. Evidence was saved and execution paused.',
});

const coupon = c => ({
  sending:
    'I am sending the shopping agent to buy two pouches with the advertised coupon. Its browser actions and outcome will be recorded, then checked independently.',
  askFact:
    c.mode === 'promotion-reset'
      ? `What minimum should the simulated coupon test be reset to? For example: "Reset it to $${COUPON_FAULT_MINIMUM}."`
      : 'What minimum subtotal did the campaign approve? For example: "The campaign minimum is $30."',
  handoff: 'The merchant confirmed the campaign minimum. Please prepare the repair proposal.',
  noChange:
    'The coupon already uses the confirmed minimum, so it needs no change. Check whether the page wording is wrong instead.',
  preparing: 'Preparing the coupon proposal. Approval buttons will appear shortly.',
  applied: 'Coupon read-back confirmed. Trying it in a fresh cart while the storefront updates.',
  cardTitle: c.mode === 'promotion-reset' ? 'Test coupon reset proposal' : 'Coupon repair proposal',
  cardChange: `Change **${c.before?.code || 'the coupon'}** minimum subtotal from **$${c.before ? currentValue(c) : '?'}** to **$${c.target}**. The percentage, products and dates stay the same.`,
  approveLabel:
    c.mode === 'promotion-reset'
      ? `Approve reset to $${c.target} minimum`
      : `Approve $${c.target} coupon minimum`,
  afterApproval:
    'After approval, the coupon will be updated and read back, then tried in a fresh shopping cart.',
  processed:
    'This proposal has been processed. Repeated clicks only show status and never repeat the coupon change.',
  cancelled: 'Cancelled. No coupon change.',
  cancelledNotice: 'Cancelled. The coupon will not be changed.',
  approvedNotice:
    'Approval received. Updating the coupon and verifying; the result will appear on this card automatically.',
  completed:
    c.mode === 'promotion-reset'
      ? `**Test coupon reset completed: minimum is $${c.target}.**\nA fresh ${c.retest ? dollars(c.retest.subtotal_cents) : ''} cart confirmed the code is rejected.`
      : `**Coupon repair completed: minimum is $${c.target}.**\n${c.retest ? `A fresh cart shows ${dollars(c.retest.discount_cents)} off, for a ${dollars(c.retest.merchandise_after_discount_cents)} merchandise subtotal before tax and shipping.` : ''}`,
  writtenNotVerified: `**The coupon minimum is now $${c.target}, but verification did not finish.**`,
  notApplied: '**Not applied: the coupon changed after this proposal.**\nNo coupon write was sent.',
  checkCurrent: 'Check the current coupon before starting a new request.',
  verdict:
    c.mode === 'promotion-reset'
      ? c.retest?.unavailable
        ? `Test coupon reset verified: the minimum is $${c.target} and a fresh ${dollars(c.retest.subtotal_cents)} cart is rejected.`
        : 'Coupon changed, but the rejected state has not been verified.'
      : c.retest?.success
        ? `Verification passed: the minimum is $${c.target} and a fresh cart shows ${dollars(c.retest.discount_cents)} off, for a ${dollars(c.retest.merchandise_after_discount_cents)} merchandise subtotal. No checkout or payment.`
        : 'Coupon changed, but the fresh cart did not show the expected discount. Evidence was saved and execution paused.',
});

export const copy = c => (isPromotion(c) ? coupon(c) : inventory(c));
