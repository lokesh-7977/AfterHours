export type CodeUnusableReason = "CODE_INACTIVE" | "CODE_REVOKED" | "CODE_EXPIRED" | "CODE_EXHAUSTED";

export interface AttendanceCodeState {
  active: boolean;
  revokedAt: Date | null;
  expiresAt: Date;
  maxUses: number | null;
  useCount: number;
}

export function attendanceCodeUnusableReason(code: AttendanceCodeState, now = new Date()): CodeUnusableReason | null {
  if (code.revokedAt) return "CODE_REVOKED";
  if (!code.active) return "CODE_INACTIVE";
  if (code.expiresAt.getTime() <= now.getTime()) return "CODE_EXPIRED";
  if (code.maxUses !== null && code.useCount >= code.maxUses) return "CODE_EXHAUSTED";
  return null;
}

/** Maximum lifetime of a shared attendance code. */
export const MAX_CODE_LIFETIME_MINUTES = 24 * 60;

/**
 * Status for a check-in. Shared codes can be passed around remotely, so
 * events that require strict venue attendance hold code check-ins for staff
 * confirmation; staff-performed QR/manual check-ins are verified directly.
 */
export function initialAttendanceStatus(method: "qr_scan" | "code" | "manual", requireStaffConfirmation: boolean): "verified" | "pending_confirmation" {
  if (method === "code" && requireStaffConfirmation) return "pending_confirmation";
  return "verified";
}
