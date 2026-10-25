"use server";

import { runAction, type ActionResult } from "@/lib/action";
import { getSessionUser } from "@/lib/auth-guards";
import { formDataToObject } from "@/lib/validation";
import { approvePayment, refundPayment, rejectPayment } from "@/modules/payments/payment.service";
import { adminCancelRegistration } from "@/modules/registrations/registration.service";
import { reissuePass, revokePass } from "@/modules/passes/pass.service";
import { PassModel } from "@/modules/passes/pass.model";
import { confirmAttendance, createAttendanceCode, manualCheckIn, revokeAttendance, revokeAttendanceCode, type AttendanceCodeDTO } from "@/modules/attendance/attendance.service";
import { moderateMedia, deleteMedia } from "@/modules/media/media.service";
import { moderateComment } from "@/modules/comments/comment.service";
import { moderateFeedback } from "@/modules/feedback/feedback.service";
import { adminRevokeSessions, setUserRole } from "@/modules/users/user.service";
import { runMaintenance } from "@/modules/admin/maintenance.service";
import { assertSuperAdmin } from "@/modules/auth/policies";
import { recordAudit } from "@/modules/audit/audit.service";
import { connectDB } from "@/lib/db";
import { errors } from "@/lib/errors";

// Every action re-resolves the session and calls a service that asserts the
// admin role itself; nothing here trusts the form beyond Zod-validated fields.

export async function paymentDecisionAction(registrationId: string, _prev: ActionResult<unknown> | null, fd: FormData): Promise<ActionResult<unknown>> {
  const decision = fd.get("decision");
  const input = formDataToObject(fd);
  return runAction(
    async () => {
      const user = await getSessionUser();
      if (decision === "approve") return approvePayment(user, registrationId, { note: input.note });
      if (decision === "reject") return rejectPayment(user, registrationId, { reason: input.reason });
      if (decision === "refund") return refundPayment(user, registrationId, { reason: input.reason, amountMinor: input.amountMinor });
      if (decision === "cancel") return adminCancelRegistration(user, registrationId, { reason: input.reason });
      throw errors.badRequest("Unknown decision");
    },
    { revalidate: ["/admin/payments", "/admin/registrations", "/admin/dashboard"], message: decision === "approve" ? "Payment approved and pass issued" : "Saved" },
  );
}

export async function passAction(registrationId: string, _prev: ActionResult<unknown> | null, fd: FormData): Promise<ActionResult<unknown>> {
  const action = fd.get("action");
  return runAction(
    async () => {
      const user = await getSessionUser();
      await connectDB();
      const pass = await PassModel.findOne({ registrationId }).select({ _id: 1 }).lean();
      if (!pass) throw errors.notFound("Pass");
      if (action === "revoke") return revokePass(user, pass._id, { reason: fd.get("reason") });
      return reissuePass(user, pass._id);
    },
    { revalidate: ["/admin/registrations"], message: action === "revoke" ? "Pass revoked" : "Pass reissued with a new QR" },
  );
}

export async function createCodeAction(eventId: string, _prev: ActionResult<{ code: string; record: AttendanceCodeDTO }> | null, fd: FormData): Promise<ActionResult<{ code: string; record: AttendanceCodeDTO }>> {
  return runAction(async () => createAttendanceCode(await getSessionUser(), eventId, formDataToObject(fd)), { revalidate: [`/admin/attendance`] });
}

export async function revokeCodeAction(codeId: string): Promise<ActionResult<unknown>> {
  return runAction(async () => revokeAttendanceCode(await getSessionUser(), codeId), { revalidate: ["/admin/attendance"] });
}

export async function attendanceCorrectionAction(attendanceId: string, _prev: ActionResult<unknown> | null, fd: FormData): Promise<ActionResult<unknown>> {
  const action = fd.get("action");
  return runAction(
    async () => {
      const user = await getSessionUser();
      if (action === "confirm") return confirmAttendance(user, attendanceId);
      return revokeAttendance(user, attendanceId, { reason: fd.get("reason") });
    },
    { revalidate: ["/admin/attendance"] },
  );
}

export async function manualCheckInAction(registrationId: string): Promise<ActionResult<unknown>> {
  return runAction(async () => manualCheckIn(await getSessionUser(), registrationId), { revalidate: ["/admin/attendance", "/admin/registrations"] });
}

export async function moderateMediaAction(mediaId: string, decision: "approved" | "rejected", reason?: string): Promise<ActionResult<unknown>> {
  return runAction(async () => moderateMedia(await getSessionUser(), mediaId, { decision, reason }), { revalidate: ["/admin/media"] });
}

export async function deleteMediaAction(mediaId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await deleteMedia(await getSessionUser(), mediaId);
    return null;
  }, { revalidate: ["/admin/media", "/my-gallery"] });
}

export async function moderateCommentAction(commentId: string, decision: "approved" | "rejected"): Promise<ActionResult<null>> {
  return runAction(async () => {
    await moderateComment(await getSessionUser(), commentId, { decision });
    return null;
  }, { revalidate: ["/admin/feedback"] });
}

export async function moderateFeedbackAction(feedbackId: string, _prev: ActionResult<null> | null, fd: FormData): Promise<ActionResult<null>> {
  return runAction(async () => {
    await moderateFeedback(await getSessionUser(), feedbackId, formDataToObject(fd));
    return null;
  }, { revalidate: ["/admin/feedback"] });
}

export async function setRoleAction(userId: string, _prev: ActionResult<unknown> | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction(async () => setUserRole(await getSessionUser(), userId, { role: fd.get("role") }), { revalidate: ["/admin/users"], message: "Role updated; their sessions were revoked" });
}

export async function revokeSessionsAction(userId: string): Promise<ActionResult<number>> {
  return runAction(async () => adminRevokeSessions(await getSessionUser(), userId), { revalidate: ["/admin/users"] });
}

export async function runMaintenanceAction(): Promise<ActionResult<Awaited<ReturnType<typeof runMaintenance>>>> {
  return runAction(async () => {
    const user = await getSessionUser();
    assertSuperAdmin(user);
    await recordAudit({ actor: user, action: "maintenance.run", entityType: "system" });
    return runMaintenance();
  });
}
