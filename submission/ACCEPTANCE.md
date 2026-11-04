# Live acceptance: coupon repair

The primary demonstration is a deliberately configured coupon mismatch on a fictional Shopify development-store product, completed November 4, 2026 (America/Los_Angeles).

| Evidence | Before repair | After human-approved repair |
|---|---|---|
| Product-page promise | 20% from $30 | Unchanged |
| Configured coupon minimum | $50 | Read back as $30 |
| Cart | Two Single pouches, $16 each: $32 | Same task in fresh sessions |
| Coupon | Rejected | Applicable |
| Discount | $0 | $6.40 |
| Merchandise subtotal, before tax/shipping | $32 | $25.60 |
| Real shopping agent duration | 20.8 seconds | 27.1 seconds |

The merchant supplied the approved campaign minimum. The analyst handed that fact to the repair agent through Switch. The card named FIXROOM20 and $50 → $30; one native human button approval authorized that proposal. Read-back confirmed $30, with the 20% rate and other recorded settings unchanged. A real browser shopping agent and a separate Playwright probe agreed on both outcomes. The completed card updated automatically. No checkout, order or payment occurred. The store is left at $30; no reset was performed for this documentation.

## Public-client live reproduction

The latest completed round used the **bundled public Node/Playwright shopper with real Anthropic decisions**, through the real Switch worker and native merchant approval. It did not use the private OpenClaw harness. The same cart-only task ran before and after the change; a separate fresh-session probe agreed on each result. The configured minimum was read back as $30, with 20% and the other recorded settings unchanged. Both human approvals and automatic completion were captured in a native window recording; shopper browser recordings were also saved locally. An edited video must label held frames and reordered scenes, not claim a continuous take.

A clean source copy installed and passed the earlier 46 + 4 local tests before live integration. The final local suite is now 47 unit/simulated-service tests and 5 Chromium/scripted-decision tests. These local tests remain distinct from the real model/Shopify acceptance above. Early public-client preflights exposed request-filter, response-format, dynamic-control, collapsed-Discount and budget-wording issues; unsuccessful attempts were retained privately, not counted as successful acceptance. No claim of measured model cost or arbitrary-theme compatibility is made.

The earlier November 3–4 coupon result used the private OpenClaw harness (169.0/118.2 seconds) and remains historical evidence in ACCEPTANCE.json. Stock acceptance is secondary. Sanitized selected results are public; credentials, callback tokens, resource IDs, raw traces and authentication footage remain private. No judge credentials or hosted deployment are supplied by this source package.
