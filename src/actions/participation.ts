"use server";

import { runAction, type ActionResult } from "@/lib/action";
import { getSessionUser } from "@/lib/auth-guards";
import { formDataToObject } from "@/lib/validation";
import { removeInterest, showInterest } from "@/modules/interests/interest.service";
import { cancelMyRegistration, registerForEvent } from "@/modules/registrations/registration.service";
import { submitPayment } from "@/modules/payments/payment.service";
import { verifyAttendanceCode, type CheckInOutcome } from "@/modules/attendance/attendance.service";
import { submitFeedback } from "@/modules/feedback/feedback.service";
import { updateProfile } from "@/modules/users/user.service";
import { markNotificationsRead } from "@/modules/notifications/notification.service";

export async function toggleInterestAction(eventId: string, interested: boolean, slug: string): Promise<ActionResult<{ interested: boolean; interestCount: number }>> {
  return runAction(
    async () => {
      const user = await getSessionUser();
      return interested ? removeInterest(user, eventId) : showInterest(user, eventId);
    },
    { revalidate: [`/event/${slug}`, "/my-events"] },
  );
}

export async function registerAction(eventId: string, slug: string, _prev: ActionResult<unknown> | null): Promise<ActionResult<unknown>> {
  return runAction(async () => registerForEvent(await getSessionUser(), eventId), { revalidate: [`/event/${slug}`, "/my-events", "/my-passes"], message: "You're registered!" });
}

export async function cancelRegistrationAction(registrationId: string, _prev: ActionResult<unknown> | null): Promise<ActionResult<unknown>> {
  return runAction(async () => cancelMyRegistration(await getSessionUser(), registrationId), { revalidate: ["/my-events"], message: "Registration cancelled" });
}

export async function submitPaymentAction(registrationId: string, _prev: ActionResult<unknown> | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction(async () => submitPayment(await getSessionUser(), registrationId, formDataToObject(fd)), { revalidate: ["/my-events"], message: "Payment details submitted for verification" });
}

export async function verifyCodeAction(eventId: string, _prev: ActionResult<CheckInOutcome> | null, fd: FormData): Promise<ActionResult<CheckInOutcome>> {
  return runAction(async () => verifyAttendanceCode(await getSessionUser(), { eventId, code: fd.get("code") }), { revalidate: ["/my-passes", "/my-gallery"] });
}

export async function submitFeedbackAction(eventId: string, slug: string, _prev: ActionResult<unknown> | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction(async () => submitFeedback(await getSessionUser(), eventId, formDataToObject(fd)), { revalidate: [`/event/${slug}`], message: "Thanks! Your feedback will appear after review." });
}

export async function updateProfileAction(_prev: ActionResult<unknown> | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction(async () => updateProfile(await getSessionUser(), formDataToObject(fd)), { revalidate: ["/profile"], message: "Profile updated" });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<number>> {
  return runAction(async () => markNotificationsRead(await getSessionUser(), "all"), { revalidate: ["/dashboard"] });
}
