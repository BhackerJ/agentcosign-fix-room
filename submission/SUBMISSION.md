# AgentCoSign Fix Room

**Proposed track:** Best Business Workflow

**One sentence:** Two agents coordinate a merchant-approved Shopify repair through Switch, then verify it by repeating the real shopping journey.

## Problem

A product page promises 20% off from $30, but the actual coupon requires $50. A shopper with a $32 cart is refused. Reading the admin value alone does not tell the merchant which campaign rule is correct, or prove that a repair works for a shopper.

## What we built

The merchant reports the problem naturally in a Mattermost channel bridged by Switch. A browser shopping agent reproduces the refused purchase; an analyst interprets its evidence and asks the merchant for the approved campaign minimum. Switch delivers that fact to the repair agent in a targeted thread. The repair agent prepares an exact $50 → $30 proposal. Only the configured human can approve its native button card.

A deterministic worker checks a fresh configuration snapshot, writes only the proposed coupon minimum, and reads it back. It then runs a fresh shopping agent and independent Playwright cart check. The original card receives completion automatically. The merchant never copies hashes or API commands.

## Why Switch matters

Switch supplies authenticated room participants, shared context, delivered events and the addressed analyst-to-repair handoff that triggers the proposal. Mattermost supplies the chat UI and button callback, not agent routing. The analyst interprets evidence and gathers the missing business fact; the repair agent prepares the bound proposal. Neither model receives store Admin tools. The worker alone controls approved mutations.

## Measured result

In the completed development-store coupon round, two $16 pouches ($32) were refused before repair. After one human approval and a verified minimum change to $30, the real shopping agent and independent probe each confirmed $6.40 off and a $25.60 merchandise subtotal, before tax/shipping. The 20% rate and other recorded settings stayed unchanged. No checkout, order or payment. See ACCEPTANCE.md and ACCEPTANCE.json.

## Public reproduction

The bundled Node/Playwright shopper asks Anthropic to choose visible browser controls and records the visit locally. A separate deterministic probe must agree; DONE alone cannot pass. No private harness is required for this mode. See JUDGE-GUIDE.md for setup and the local no-key tests.

The latest completed live round used the bundled public client with real Anthropic decisions, native human approval and fresh Shopify carts. The public client and independent probe agreed before and after. Earlier OpenClaw runs are listed separately as historical evidence. Judges still need their own configured development store, model key and Switch room; no hosted judge account is claimed.

## Scope and limits

Deliberately configured faults on fictional development-store products, not proactive fault discovery. Coupon minimum and stock repair only; no arbitrary store fixes. The merchant's campaign fact is asserted, not audited. Shopify has no coupon compare-and-set: a fresh pre-write comparison and read-back reduce, but do not eliminate, the concurrent-edit window. Unknown writes require reconciliation; no automatic rollback or blind retry. Manual store/Switch setup is required.

Repository: https://github.com/BhackerJ/agentcosign-fix-room

Coupon demo: real browser and approval footage recorded; final video and presenter recording are being prepared. Existing stock footage is secondary historical material.
