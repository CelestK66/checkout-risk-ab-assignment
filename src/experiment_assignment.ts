import { createHash } from "node:crypto";
import { z } from "zod";

export const paymentEventSchema = z.object({
  eventId: z.string().min(1).max(100),
  shopperId: z.string().min(1).max(100),
  amountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  riskScore: z.number().int().min(0).max(100),
  occurredAt: z.string().datetime(),
});

export type PaymentEvent = z.infer<typeof paymentEventSchema>;
export type Variant = "control" | "risk_prompt";
export type PaymentAction = "approve" | "step_up" | "manual_review";

export type CheckoutDecision = {
  eventId: string;
  shopperId: string;
  experiment: "fintech-checkout-risk-v1";
  variant: Variant;
  action: PaymentAction;
  notification: {
    auditId: string;
    category: "payment_risk_decision";
    summary: string;
    occurredAt: string;
  };
};

function bucket(shopperId: string, salt: string): number {
  const digest = createHash("sha256").update(`${salt}:${shopperId}`).digest();
  return digest.readUInt32BE(0) / 0x1_0000_0000;
}

export function assignVariant(shopperId: string, experimentEnabled: boolean): Variant {
  if (!experimentEnabled) return "control";
  return bucket(shopperId.trim().toLowerCase(), "fintech-checkout-risk-v1") < 0.5
    ? "control"
    : "risk_prompt";
}

export function decidePayment(event: PaymentEvent, experimentEnabled: boolean): CheckoutDecision {
  const variant = assignVariant(event.shopperId, experimentEnabled);
  const action: PaymentAction = event.riskScore >= 80
    ? "manual_review"
    : event.riskScore >= (variant === "risk_prompt" ? 50 : 60)
      ? "step_up"
      : "approve";

  return {
    eventId: event.eventId,
    shopperId: event.shopperId,
    experiment: "fintech-checkout-risk-v1",
    variant,
    action,
    notification: {
      auditId: `payment-risk:${event.eventId}`,
      category: "payment_risk_decision",
      summary: `${event.currency} ${event.amountMinor} minor units: ${action} under ${variant}`,
      occurredAt: event.occurredAt,
    },
  };
}
