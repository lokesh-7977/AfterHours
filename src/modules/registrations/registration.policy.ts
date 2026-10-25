import type { PaymentStatus, RegistrationStatus } from "./registration.constants";

export interface RegistrationState {
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  amountMinor: number;
}

/**
 * Manual payment state machine.
 * pending   -> submitted (participant) | approved (admin, e.g. cash) | rejected (admin)
 * submitted -> submitted (participant corrects details) | approved | rejected
 * rejected  -> submitted (participant resubmits) | approved (admin correction)
 * approved  -> refunded
 * refunded  -> (terminal)
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ["submitted", "approved", "rejected"],
  submitted: ["submitted", "approved", "rejected"],
  rejected: ["submitted", "approved"],
  approved: ["refunded"],
  refunded: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

const active = (r: RegistrationState) => r.status === "registered";

export function canSubmitPayment(r: RegistrationState): boolean {
  return active(r) && r.amountMinor > 0 && canTransitionPayment(r.paymentStatus, "submitted");
}

export function canApprovePayment(r: RegistrationState): boolean {
  return active(r) && canTransitionPayment(r.paymentStatus, "approved");
}

export function canRejectPayment(r: RegistrationState): boolean {
  return active(r) && canTransitionPayment(r.paymentStatus, "rejected");
}

export function canRefundPayment(r: RegistrationState): boolean {
  return active(r) && r.paymentStatus === "approved";
}

/** Registrations can be cancelled (by participant or admin) until payment is approved; afterwards a refund is required. */
export function canCancelRegistration(r: RegistrationState): boolean {
  return active(r) && r.paymentStatus !== "approved";
}


/** The only state in which a pass may exist in active form. */
export function isPassEligible(r: Pick<RegistrationState, "status" | "paymentStatus">): boolean {
  return r.status === "registered" && r.paymentStatus === "approved";
}
