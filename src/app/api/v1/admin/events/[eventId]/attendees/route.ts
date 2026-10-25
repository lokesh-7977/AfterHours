import { apiRoute, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { toCsvRow } from "@/lib/csv";
import { fromMinor } from "@/lib/money";
import { assertAdmin } from "@/modules/auth/policies";
import { getManageableEvent } from "@/modules/events/event.service";
import { iterateEventAttendees } from "@/modules/registrations/registration.service";

const HEADER = ["Registration ID", "Name", "Email", "Phone", "Status", "Payment", "Method", "Reference", "Amount", "Currency", "Pass", "Attendance", "Registered at"];

/** Streams a CSV attendee export (admin only). */
export const GET = apiRoute<{ eventId: string }>(async (_req, { params }) => {
  const user = await getSessionUser();
  assertAdmin(user);
  const event = await getManageableEvent(user, readId(params.eventId, "Event"));
  const encoder = new TextEncoder();
  const rows = iterateEventAttendees(user, event._id);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(toCsvRow(HEADER)));
    },
    async pull(controller) {
      const next = await rows.next();
      if (next.done) return controller.close();
      const r = next.value;
      controller.enqueue(encoder.encode(toCsvRow([r.id, r.user?.name ?? "", r.user?.email ?? "", r.user?.phone ?? "", r.status, r.paymentStatus, r.paymentMethod ?? "", r.paymentReference ?? "", fromMinor(r.amountMinor, r.currency), r.currency, r.passStatus ?? "", r.attendanceStatus ?? "", r.createdAt])));
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attendees-' + event.slug + '.csv"',
      "Cache-Control": "private, no-store",
    },
  });
});
