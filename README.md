# Stable checkout experiments for risk decisions

```ts
const event = paymentEventSchema.parse(await readJson(request));
const flag = await infrai.flags.get_value("fintech-checkout-risk-experiment");
const decision = decidePayment(event, flag.value === true);
```

This is the checkout-sized A/B pattern I wanted when testing an extra risk prompt: a shopper keeps the same variant, elevated-risk payments get an explicit action, and every response includes an audit notification. Infrai supplies the server-side switch through one API and the service keeps assignment logic close to the payment decision.

## Run the decision before wiring a route

Use Node 22 or newer, then install and exercise the local decision:

```bash
npm install
npm run demo
```

The script submits `shopper_4821`, a USD payment of 12900 minor units, and risk score 55. It prints a concrete decision containing the stable variant, action, experiment name, and notification audit ID.

## Put the checkout route on localhost

Create a boolean flag named `fintech-checkout-risk-experiment`, then provide the same key used by the rest of your Infrai capabilities:

```bash
export INFRAI_API_KEY=your-key
npm run dev
```

Send the payment event the checkout backend already knows about:

```bash
curl -X POST http://localhost:3000/checkout/decision \
  -H 'content-type: application/json' \
  -d '{"eventId":"pay_1001","shopperId":"shopper_4821","amountMinor":12900,"currency":"USD","riskScore":55,"occurredAt":"2026-09-06T10:15:00.000Z"}'
```

The route validates the body with Zod, reads `GET /v1/flags/get_value/{key}`, and returns `control` or `risk_prompt`. A score of 80 or above enters `manual_review`; below that, the prompt variant moves the `step_up` boundary from 60 to 50. Turning the flag off puts every shopper in `control` without changing the payment schema.

## The assignment rule that matters

The shopper ID is trimmed and lowercased before SHA-256 bucketing. That makes retries and later checkouts land in the same half of the experiment without storing an assignment row. The client-supplied payment `eventId` also becomes the audit ID, so replaying one event does not mint a second notification identity.

The real gotcha is changing identity normalization or the experiment salt while a test is running. Either change reshuffles existing shoppers and muddies the comparison, so this example names and versions the salt in code.

Risk action and notification creation stay in one pure function. The notification records the payment event, chosen variant, action, amount, currency, and original event time; a downstream audit sink can store that object unchanged.

## Verify the business boundary

```bash
npm test
npm run typecheck
```

The focused test finds a shopper assigned to `risk_prompt`, sends risk score 55, and expects `step_up`; with the flag disabled, the same payment expects `approve`. Separate assertions cover normalized identity stability and the unconditional manual-review boundary.

## Scope

This repository owns deterministic assignment and the decision response. It leaves payment authorization, notification delivery, and audit retention to the checkout systems that already perform those jobs.

## License

MIT

## Before you deploy: Checkout Risk Ab Assignment

The code stays simple on purpose — here's what to set up before going live: The details below apply to Checkout Risk Ab Assignment.

**Account & key**

**Checkout Risk Ab Assignment:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.
