# English-only demo recording script (2–3 minutes)

Use English narration, captions and chat messages throughout. Start at the new
English conversation; earlier Chinese test history is not part of the demo.

Before recording: worker online; analyst and repair agent connected to the same
Switch room; dedicated fictional product has 25 available units. Keep the room
open throughout. Do not refresh or cut around failures. Do not show credentials,
callback context, developer tools, or raw state files. No checkout or payment.

1. **0:00 — Problem (15 seconds).** “A stock mismatch can stop a merchant selling.
   Fix Room lets the merchant resolve it in team chat with two agents and a human approval.”
2. **0:15 — Explain the room (15 seconds).** Identify the human, analyst and repair
   agent. “Switch delivers messages, shared room context and the agent-to-agent handoff.”
3. **0:30 — Reset fixture (30–45 seconds).** Say/type `Reset the test inventory to zero.`.
   When asked, reply `The warehouse has 0 units.`. Show the proposal's 25 → 0 change. The human
   clicks **Approve reset to 0 units** once. Capture the immediate approved/executing card
   and its automatic completed result. Explain that this sets up the simulated incident.
4. **1:15 — Diagnose and propose (30 seconds).** Say/type `Why can’t customers buy the towel?`.
   Show the analyst's sold-out finding. Reply `The warehouse has 25 units.`. Show the Switch handoff
   to the repair agent and its 0 → 25 proposal.
5. **1:45 — Approve and verify (30–45 seconds).** Human clicks **Approve restock to 25 units**.
   Keep the same page visible: approved/executing → inventory read-back → storefront
   propagation → clean-cart retest. Show completed stock 25 and one matching cart item.
6. **2:30 — Close (15 seconds).** “Models interpret and explain. Deterministic code
   validates approval and inventory writes; Playwright checks the real storefront.
   No checkout. Source and setup instructions are in the repository.”

Acceptance checklist: no refresh; immediate visible acknowledgement captured;
completion appears automatically; both agents' handoff visible; human performs
both approvals; inventory and cart results visible. If any step fails, keep the
failure evidence and fix it before claiming this recording is successful.

Video URL: pending recording and upload.
