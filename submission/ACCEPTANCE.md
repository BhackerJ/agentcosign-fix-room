# Live acceptance record

A real Switch room with two agent clients and a human merchant completed this
natural-language reset → stock round on November 3, 2026.

| Phase | Human approval | Inventory | Public storefront | Fresh cart |
|---|---|---|---|---|
| Reset | Native Mattermost button | Read-back 0 | Unavailable, attempt 2 | Empty; sold-out button disabled |
| Stock | Native Mattermost button | Read-back 25 | Available, attempt 2 | One matching Single towel; price 1200 cents |

Both cases reached completed state. No checkout or payment. Machine-readable,
sanitary summaries are in ACCEPTANCE.json. Private callback tokens, room/user
identifiers and store credentials are excluded.

The existing page showed the reset completion without navigation or refresh.
Status buttons were checked by clicking and observing updated text in the same
card. A separate server-side card patch was also received by the page without a
refresh after configuring the correct local WebSocket address.

The full latest round was not continuously recorded or instrumented for click
latency. Immediate approval feedback is covered by a callback integration test;
a video should capture both immediate acknowledgement and automatic completion
before claiming a measured end-to-end UI latency. The stock completion in this
record is supported by durable executor and browser results, not a continuous
screen recording. Do not describe this as a production deployment or a proven
recovery from arbitrary crashes.
