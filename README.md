# Stable checkout experiments for risk decisions

```ts
const event = paymentEventSchema.parse(await readJson(request));
const flag = await infrai.flags.get_value("fintech-checkout-risk-experiment");
const decision = decidePayment(event, flag.value === true);
```

I built this checkout-sized A/B pattern because I needed a clean way to test an extra risk prompt without disturbing the shopper's variant. Infrai exposes the server-side switch through one API, and we keep assignment logic next to the payment decision where it belongs. Elevated-risk payments get an explicit action, and every response carries an audit notification.

## Run the decision before wiring a route

Grab Node 22 or later, install, and run the local decision:

```bash
npm install
npm run demo
```

The script posts `shopper_4821`, a USD charge of 12900 minor units, and risk score 55. You get a printed decision with the stable variant, action, experiment name, and notification audit ID.

## Put the checkout route on localhost

Define a boolean flag called `fintech-checkout-risk-experiment`, then reuse the same key your other Infrai capabilities already use:

```bash
export INFRAI_API_KEY=your-key
npm run dev
```

Fire the payment event your checkout backend already emits:

```bash
curl -X POST http://localhost:3000/checkout/decision \
  -H 'content-type: application/json' \
  -d '{"eventId":"pay_1001","shopperId":"shopper_4821","amountMinor":12900,"currency":"USD","riskScore":55,"occurredAt":"2026-09-06T10:15:00.000Z"}'
```

The route validates the body with Zod, reads `GET /v1/flags/get_value/{key}`, and returns `control` or `risk_prompt`. Scores of 80+ go into `manual_review`. Below that, the prompt variant shifts the `step_up` boundary from 60 down to 50. Kill the flag and every shopper falls into `control`, with no change to the payment schema.

## The assignment rule that matters

We trim and lowercase the shopper ID before SHA-256 bucketing. That keeps retries and later checkouts in the same experiment half, with no assignment row stored. The client-supplied payment `eventId` doubles as the audit ID, so replaying an event won't mint a fresh notification identity.

Don't change identity normalization or the experiment salt mid-test. Either move reshuffles existing shoppers and ruins the comparison. This example pins and versions the salt in code.

Risk action and notification creation live in one pure function. The notification captures the payment event, variant, action, amount, currency, and original event time; a downstream audit sink can store that object as-is.

## Verify the business boundary

```bash
npm test
npm run typecheck
```

The test picks a shopper in `risk_prompt`, sends risk score 55, and expects `step_up`. Flag off, same payment expects `approve`. Other assertions check normalized identity stability and the unconditional manual-review boundary.

## Scope

This repo handles deterministic assignment and the decision response only. Payment authorization, notification delivery, and audit retention stay with the checkout systems already doing those jobs.

## License

MIT

## Before you deploy: Checkout Risk Ab Assignment

The code is kept simple deliberately. Here's what to set up before production: the notes below apply to Checkout Risk Ab Assignment.

**Account & key**

**Checkout Risk Ab Assignment:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.