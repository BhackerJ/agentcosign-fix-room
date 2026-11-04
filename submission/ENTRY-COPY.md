# Human submission copy

## Title
AgentCoSign Fix Room

## Tagline
Human-approved Shopify repairs, coordinated through Switch and verified through a real shopping journey.

## Track
Best Business Workflow

## Project description
A product page promises 20% off from $30, but its coupon actually requires $50. Fix Room lets a merchant report the refused purchase in team chat. A real shopping agent reproduces it; an analyst asks the merchant for the approved campaign minimum, then uses a targeted Switch thread to hand that fact to a repair agent. The repair agent posts an exact proposal. Only the configured human merchant can approve it.

The deterministic worker changes only the approved minimum, reads it back, and repeats the shopping task in fresh sessions. The public model-driven browser client and a separate Playwright probe must agree before the task is marked complete. In the November 4 live round, the $32 cart was rejected before repair. After the human-approved $50 → $30 change, both checks confirmed $6.40 off and a $25.60 merchandise subtotal, before tax/shipping. No checkout, order or payment.

Switch carries authenticated room context, delivered events and the addressed analyst-to-repair handoff. Mattermost provides the chat UI and native approval card. The public repository includes the shopper, worker, tests and setup guide; no private shopping harness is required. The incident is deliberately configured on fictional development-store products, not a claim of proactively finding a customer fault.

## Repository
https://github.com/BhackerJ/agentcosign-fix-room

## Reproduction instructions
https://github.com/BhackerJ/agentcosign-fix-room/blob/main/submission/JUDGE-GUIDE.md

## Demo video
Final presenter video completed: approximately 2 minutes, 1080p, with the builder’s English narration and face-to-camera inset. Shows the controlled coupon fixture reset, real shopping baseline, Switch handoff, human-approved repair and automatic verified completion. YouTube: https://youtu.be/FEW8cEMk9xg

## How did you use Switch in your project?
We connected two custom Anthropic-backed Node agents, an analyst and a repair agent, to a shared Switch room bridged to Mattermost. The merchant reports the shopping problem in natural language. The analyst interprets the model-driven browser evidence and asks for the intended campaign minimum. It addresses the repair agent through Switch with that confirmed business fact, triggering an exact proposal in the merchant’s chat. The merchant approves a native button card. A deterministic worker validates the approval and current configuration, changes only the approved field, reads it back, and runs a fresh shopping agent plus an independent Playwright check. Switch carries shared room context, participant identity, delivered events and the targeted handoff; Mattermost supplies the UI and callback. Completion appears automatically without refreshing.

## What did you like about Switch, and what would you improve?
Switch let us give the analyst and repair agent distinct identities and coordinate a concrete handoff inside the merchant’s existing team conversation. The shared context and addressed messages made the human’s campaign decision available where the repair proposal was prepared. Setup was the hardest part: diagnosing participant permissions and 403 responses, connecting the Mattermost bridge, and verifying callback reachability and live updates required work across several services. We would improve permission diagnostics, provide an end-to-end custom-agent/Mattermost approval example, and add clearer delivery and reconnection status for debugging.

## Submission status — checked November 4, 2026
The official submission form is now available. It requires a project title, track, project description, public GitHub repository, public or unlisted demo under three minutes, and two answers about Switch usage and feedback. Best Business Workflow is the intended track. Live deployment is optional; leave it blank because this project requires local setup. Optional blog, Wispr card and social-post fields should remain blank unless the entrant supplies qualifying material.

Official rules Section 3(b) prohibit automated registration/submission. The entrant must personally complete and submit the official form. No completed submission is claimed.

Official event: https://www.wemakedevs.org/hackathons/switch
Official submission route: https://www.wemakedevs.org/hackathons/switch/submit
Official rules: https://www.wemakedevs.org/hackathons/switch/rules
