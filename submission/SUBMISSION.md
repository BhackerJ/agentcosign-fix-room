# AgentCoSign Fix Room

**Track:** Best Business Workflow

**One sentence:** Two agents help a Shopify merchant diagnose a stock mismatch,
propose a precise repair, obtain human approval in team chat, and verify that a
customer can add the product to a fresh cart.

## Problem
A product can be physically available while its online inventory says zero.
A merchant needs a safe path from a report in chat to a verified repair, without
copying API commands or trusting an agent's unsupported “fixed” message.

## What we built
The merchant speaks naturally in a Mattermost channel bridged by Switch. An
analyst examines the storefront, asks for the actual quantity, and passes that
fact to a repair agent through a targeted Switch thread. The repair agent posts
a native approval card. Only the configured human can approve that proposal.
The executor checks for concurrent changes, writes inventory, reads it back,
waits for storefront propagation, then opens a clean browser cart session.
The room and original card receive the result automatically.

## Why Switch is central
Switch supplies room membership, message delivery, shared context and the
addressed analyst-to-repair handoff. Both agents are live protocol clients.
The worker reacts to delivered room events; the repair proposal is triggered by
the handoff. Removing Switch breaks that event and collaboration path. Mattermost
provides the chat UI and native button callback; it is not the agent routing layer.

## Implementation boundaries
Anthropic interprets natural language and explains evidence. A deterministic
Node worker controls the state machine, proposal binding and inventory API.
The shopping check is a fixed-task Playwright probe, not an autonomous shopping
agent. Shopify is a development-store fixture; no checkout or payment occurs.
Human quantity is an asserted warehouse fact, not independently audited stock.

## Demonstrated result
A real human-approved reset → stock round completed: 25 → 0 produced a sold-out
page and empty fresh cart; 0 → 25 produced public availability and one matching
item in a fresh cart. Both propagation checks converged on attempt two.
See ACCEPTANCE.md for the evidence boundaries.

## Links
Repository: https://github.com/BhackerJ/agentcosign-fix-room
Demo video: pending recording

## Current limits
One dedicated product, stock only, standard Shopify form selectors, manual
infrastructure and fixture setup. No automatic rollback or crash recovery.
Unknown writes require operator reconciliation; no blind mutation retry.
