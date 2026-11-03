# Demo recording script (2–3 minutes)

Before recording: worker online; analyst and repair agent connected to the same
Switch room; dedicated fictional product has 25 available units. Keep the room
open throughout. Do not refresh or cut around failures. Do not show credentials,
callback context, developer tools, or raw state files. No checkout or payment.

1. **0:00 — Problem (15 seconds).** “A stock mismatch can stop a merchant selling.
   Fix Room lets the merchant resolve it in team chat with two agents and a human approval.”
2. **0:15 — Explain the room (15 seconds).** Identify the human, analyst and repair
   agent. “Switch delivers messages, shared room context and the agent-to-agent handoff.”
3. **0:30 — Reset fixture (30–45 seconds).** Say/type `请把测试库存恢复为零`.
   When asked, reply `仓库有0件`. Show the proposal's 25 → 0 change. The human
   clicks **批准恢复到 0 件** once. Capture the immediate approved/executing card
   and its automatic completed result. Explain that this sets up the simulated incident.
4. **1:15 — Diagnose and propose (30 seconds).** Say/type `帮我看看毛巾为什么买不了`.
   Show the analyst's sold-out finding. Reply `仓库有25件`. Show the Switch handoff
   to the repair agent and its 0 → 25 proposal.
5. **1:45 — Approve and verify (30–45 seconds).** Human clicks **批准补货到 25 件**.
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
