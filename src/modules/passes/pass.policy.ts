import type { EventStatus } from "@/modules/events/event.constants";
import type { PaymentStatus, RegistrationStatus } from "@/modules/registrations/registration.constants";
import type { PassStatus } from "./pass.model";

/** Check-in opens this long before the event starts and closes this long after it ends. */
export const CHECK_IN_OPENS_BEFORE_MS = 6 * 60 * 60 * 1000;
export const CHECK_IN_GRACE_AFTER_END_MS = 60 * 60 * 1000;

/** Prefix identifying our QR payload format; the rest is an opaque random token. */
export const QR_PAYLOAD_PREFIX = "GTHR1.";

export type PassInvalidReason =
  | "PASS_REVOKED"
  | "REGISTRATION_INACTIVE"
  | "PAYMENT_NOT_APPROVED"
  | "EVENT_CANCELLED"
  | "EVENT_UNAVAILABLE"
  | "WRONG_EVENT"
  | "CHECK_IN_NOT_OPEN"
  | "CHECK_IN_CLOSED";

export const PASS_INVALID_MESSAGES: Record<PassInvalidReason, string> = {
  PASS_REVOKED: "This pass has been revoked",
  REGISTRATION_INACTIVE: "The registration is cancelled or refunded",
  PAYMENT_NOT_APPROVED: "Payment has not been approved",
  EVENT_CANCELLED: "The event has been cancelled",
  EVENT_UNAVAILABLE: "The event is not available",
  WRONG_EVENT: "This pass is for a different event",
  CHECK_IN_NOT_OPEN: "Check-in has not opened for this event yet",
  CHECK_IN_CLOSED: "Check-in for this event has closed",
};

export interface PassValidityInput {
  pass: { status: PassStatus; eventId: string };
  registration: { status: RegistrationStatus; paymentStatus: PaymentStatus } | null;
  event: { _id: string; status: EventStatus; deletedAt: Date | null; startsAt: Date; endsAt: Date } | null;
  expectedEventId?: string;
  now?: Date;
  enforceCheckInWindow?: boolean;
}

/**
 * Every condition is derived from server-side records. Client-supplied
 * flags (isPaid, paymentStatus, isVerified...) are never consulted.
 */
export function passInvalidReason(input: PassValidityInput): PassInvalidReason | null {
  const { pass, registration, event } = input;
  const now = input.now ?? new Date();
  if (input.expectedEventId && pass.eventId !== input.expectedEventId) return "WRONG_EVENT";
  if (pass.status !== "active") return "PASS_REVOKED";
  if (!registration || registration.status !== "registered") return "REGISTRATION_INACTIVE";
  if (registration.paymentStatus !== "approved") return "PAYMENT_NOT_APPROVED";
  if (!event || event.deletedAt) return "EVENT_UNAVAILABLE";
  if (event.status === "cancelled") return "EVENT_CANCELLED";
  if (event.status === "draft") return "EVENT_UNAVAILABLE";
  if (input.enforceCheckInWindow) {
    if (now.getTime() < event.startsAt.getTime() - CHECK_IN_OPENS_BEFORE_MS) return "CHECK_IN_NOT_OPEN";
    if (now.getTime() > event.endsAt.getTime() + CHECK_IN_GRACE_AFTER_END_MS) return "CHECK_IN_CLOSED";
  }
  return null;
}

export function extractQrToken(payload: string): string | null {
  const trimmed = payload.trim();
  const token = trimmed.startsWith(QR_PAYLOAD_PREFIX) ? trimmed.slice(QR_PAYLOAD_PREFIX.length) : trimmed;
  return /^[A-Za-z0-9_-]{40,64}$/.test(token) ? token : null;
}
