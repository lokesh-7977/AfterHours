import type { EventStatus } from "./event.constants";

/** Allowed lifecycle transitions. Cancelled and completed are terminal. */
export const EVENT_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ["published", "cancelled"],
  published: ["cancelled", "completed"],
  cancelled: [],
  completed: [],
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return EVENT_TRANSITIONS[from].includes(to);
}

export interface EventSchedule {
  startsAt: Date;
  endsAt: Date;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
}

/** Returns field errors for an inconsistent schedule (empty object when valid). */
export function validateSchedule(s: EventSchedule, opts: { now?: Date; requireFuture?: boolean } = {}): Record<string, string[]> {
  const errs: Record<string, string[]> = {};
  const add = (k: string, m: string) => (errs[k] ??= []).push(m);
  if (s.endsAt <= s.startsAt) add("endsAt", "End time must be after the start time");
  if (s.registrationClosesAt <= s.registrationOpensAt) add("registrationClosesAt", "Registration must close after it opens");
  if (s.registrationClosesAt > s.endsAt) add("registrationClosesAt", "Registration must close before the event ends");
  if (s.registrationOpensAt > s.startsAt) add("registrationOpensAt", "Registration must open before the event starts");
  if (opts.requireFuture && s.endsAt <= (opts.now ?? new Date())) add("endsAt", "The event must end in the future");
  return errs;
}

export interface RegistrationWindowEvent extends EventSchedule {
  status: EventStatus;
  deletedAt: Date | null;
  capacity: number;
  registeredCount: number;
}

export type RegistrationBlockReason =
  | "EVENT_NOT_PUBLISHED"
  | "EVENT_CANCELLED"
  | "REGISTRATION_NOT_OPEN"
  | "REGISTRATION_CLOSED"
  | "CAPACITY_FULL";

/** Why a new registration is not possible right now, or null if it is. */
export function registrationBlockReason(e: RegistrationWindowEvent, now = new Date()): RegistrationBlockReason | null {
  if (e.deletedAt) return "EVENT_NOT_PUBLISHED";
  if (e.status === "cancelled") return "EVENT_CANCELLED";
  if (e.status !== "published") return "EVENT_NOT_PUBLISHED";
  if (now < e.registrationOpensAt) return "REGISTRATION_NOT_OPEN";
  if (now > e.registrationClosesAt || now > e.endsAt) return "REGISTRATION_CLOSED";
  if (e.registeredCount >= e.capacity) return "CAPACITY_FULL";
  return null;
}

export const REGISTRATION_BLOCK_MESSAGES: Record<RegistrationBlockReason, string> = {
  EVENT_NOT_PUBLISHED: "This event is not open for registration",
  EVENT_CANCELLED: "This event has been cancelled",
  REGISTRATION_NOT_OPEN: "Registration has not opened yet",
  REGISTRATION_CLOSED: "Registration is closed",
  CAPACITY_FULL: "This event is full",
};

/** Public visitors see published, cancelled and completed events that are not deleted. */
export function isPubliclyVisible(e: { status: EventStatus; deletedAt: Date | null }): boolean {
  return !e.deletedAt && e.status !== "draft";
}

export function isEditable(status: EventStatus): boolean {
  return status === "draft" || status === "published";
}

/** Deleting would orphan paid participants, so events with held seats must be cancelled first. */
export function canSoftDelete(e: { status: EventStatus; registeredCount: number }): boolean {
  return e.status === "draft" || e.status === "cancelled" || e.registeredCount === 0;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
