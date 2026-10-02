import { decidePayment, paymentEventSchema } from "./experiment_assignment.js";
import { infrai } from "./infrai_flags.js";

const flagKey = "fintech-checkout-risk-experiment";

const event = paymentEventSchema.parse({
  eventId: "pay_2026_0906_001",
  shopperId: "shopper_4821",
  amountMinor: 12900,
  currency: "USD",
  riskScore: 55,
  occurredAt: "2026-09-06T10:15:00.000Z",
});

const flag = await infrai.flags.get_value(flagKey);
console.log(JSON.stringify(decidePayment(event, flag.value === true), null, 2));
