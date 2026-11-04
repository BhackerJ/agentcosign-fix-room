# Judge reproduction guide

## 1. Verify the public client without credentials or paid calls

```sh
npm ci
npx playwright install chromium
npm test
npm run test:browser
```

The first suite exercises approval identity/state, snapshots, writes/read-back and result gates with simulated services. The browser suite starts a local fake shop and uses scripted decisions instead of Anthropic. It tests delayed coupon rejection/success, no actions after rejection, checkout denial and an unsupported DONE. These are local component/integration checks, not a real Shopify repair or model-quality evaluation.

## 2. Run the complete workflow on your own development store

Follow README setup for a real Switch room, two agent identities, verified merchant sender mapping, Mattermost button callbacks and Shopify app permissions. Create a fictional product **Demo Travel Pouch**, variant **Single**, $16, with at least two sellable units; use a standard Shopify theme with an editable cart Discount section. Configure **FIXROOM20**, 20%, limited to that product, active dates that cover your test, no conflicting combinations and a $50 minimum. Its product page should deliberately advertise a $30 minimum. This is your test fixture, not a production fault.

Fill `.env` from `.env.example`, including DISCOUNT_ID, DISCOUNT_CODE, OFFER_HANDLE and OFFER_VARIANT_ID. Stock fixture IDs are also required by the current worker configuration; use a dedicated tracked **Demo Hand Towel / Single / $12** product. Set `SHOPPER_MODE=public`, `SHOPPER_HEADLESS=false`, ANTHROPIC_API_KEY and ANTHROPIC_MODEL. If the visible Shopify browser requests verification, the human completes it; the client never instructs the model to click verification. The bundled shopper uses the ordinary Anthropic Messages API and Playwright; no private AgentCoSign installation is required. Running it uses your model account. Do not put credentials in chat or commit `.env`.

Start `npm start`. In Fix Room:

1. “Why was the FIXROOM20 coupon rejected?” Wait for the before-visit evidence and analyst question.
2. “The campaign minimum is $30.” Inspect the targeted analyst-to-repair thread and exact $50 → $30 card.
3. The configured human clicks the new approval button once. Observe acknowledgement and automatic completion without refreshing.
4. Require a $30 read-back, unchanged percentage, applicable FIXROOM20 on two $16 pouches, $6.40 discount and $25.60 merchandise subtotal in fresh sessions. Review local `runs/` evidence if inconclusive; do not treat the card alone as sufficient proof.

A model claim or probe alone cannot pass. Challenges/429, changed snapshots, unknown writes, unconfirmed carts and wrong amounts stop or block the workflow. A blocked outcome is not a successful repair. There is no checkout/payment step. Do not reuse an old approval. No hosted judge account or shared credentials are supplied in this source package.

## Verification status

The latest complete coupon round used this bundled public client with real Anthropic and Shopify, two real Switch agents and native human approval. Both independent outcomes agreed: rejection at a $50 minimum, then $6.40 off and $25.60 merchandise subtotal after the approved $30 minimum. Historical OpenClaw runs are separate. The clean-copy/local browser tests use scripted decisions and are not live-service claims. Theme selectors, browser challenges and model selection can still fail: retain the evidence and do not count an inconclusive run as repaired. No hosted deployment or shared judge credentials is claimed.
