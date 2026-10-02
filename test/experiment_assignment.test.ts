import assert from "node:assert/strict";
import test from "node:test";
import { assignVariant, decidePayment, paymentEventSchema } from "../src/experiment_assignment.js";

test("the same normalized shopper stays in one experiment variant", () => {
  const first = assignVariant(" Shopper-42 ", true);
  assert.equal(assignVariant("shopper-42", true), first);
  assert.equal(assignVariant("SHOPPER-42", true), first);
});

test("the risk prompt changes the decision at the experiment boundary", () => {
  let shopperId = "";
  for (let index = 0; index < 10_000; index += 1) {
    const candidate = `shopper-${index}`;
    if (assignVariant(candidate, true) === "risk_prompt") {
      shopperId = candidate;
      break;
    }
  }
  assert.notEqual(shopperId, "");

  const event = paymentEventSchema.parse({
    eventId: "pay_boundary",
    shopperId,
    amountMinor: 7500,
    currency: "USD",
    riskScore: 55,
    occurredAt: "2026-09-06T10:15:00.000Z",
  });

  const prompted = decidePayment(event, true);
  assert.equal(prompted.action, "step_up");
  assert.equal(prompted.notification.auditId, "payment-risk:pay_boundary");
  assert.equal(decidePayment(event, true).notification.auditId, prompted.notification.auditId);
  assert.equal(decidePayment(event, false).action, "approve");
});

test("high-risk payments always enter manual review", () => {
  const event = paymentEventSchema.parse({
    eventId: "pay_review",
    shopperId: "shopper-review",
    amountMinor: 250000,
    currency: "EUR",
    riskScore: 91,
    occurredAt: "2026-09-06T10:15:00.000Z",
  });

  assert.equal(decidePayment(event, true).action, "manual_review");
});
