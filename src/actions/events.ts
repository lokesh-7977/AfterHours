"use server";

import { redirect } from "next/navigation";
import { runAction, type ActionResult } from "@/lib/action";
import { getSessionUser } from "@/lib/auth-guards";
import { formDataToObject } from "@/lib/validation";
import { cancelEvent, completeEvent, createEvent, deleteEvent, publishEvent, setEventPoster, updateEvent } from "@/modules/events/event.service";
import type { EventAdminDTO } from "@/modules/events/event.dto";

export async function createEventAction(_prev: ActionResult<EventAdminDTO> | null, fd: FormData): Promise<ActionResult<EventAdminDTO>> {
  const result = await runAction(async () => createEvent(await getSessionUser(), formDataToObject(fd)), { revalidate: ["/admin/events"] });
  if (result.ok) redirect(`/admin/events/${result.data.id}?created=1`);
  return result;
}

export async function updateEventAction(eventId: string, _prev: ActionResult<EventAdminDTO> | null, fd: FormData): Promise<ActionResult<EventAdminDTO>> {
  return runAction(async () => updateEvent(await getSessionUser(), eventId, formDataToObject(fd)), {
    revalidate: [`/admin/events/${eventId}`, "/events"],
    message: "Event saved",
  });
}

export async function eventStatusAction(eventId: string, _prev: ActionResult<EventAdminDTO> | null, fd: FormData): Promise<ActionResult<EventAdminDTO>> {
  const action = fd.get("action");
  return runAction(
    async () => {
      const user = await getSessionUser();
      if (action === "publish") return publishEvent(user, eventId);
      if (action === "complete") return completeEvent(user, eventId);
      return cancelEvent(user, eventId, { reason: fd.get("reason") });
    },
    { revalidate: [`/admin/events/${eventId}`, "/admin/events", "/events"], message: action === "publish" ? "Event published" : action === "complete" ? "Event completed" : "Event cancelled" },
  );
}

export async function deleteEventAction(eventId: string, _prev: ActionResult<null> | null): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    await deleteEvent(await getSessionUser(), eventId);
    return null;
  }, { revalidate: ["/admin/events", "/events"] });
  if (result.ok) redirect("/admin/events?deleted=1");
  return result;
}

export async function setPosterAction(eventId: string, mediaId: string | null): Promise<ActionResult<EventAdminDTO>> {
  return runAction(async () => setEventPoster(await getSessionUser(), eventId, mediaId), { revalidate: [`/admin/events/${eventId}`] });
}
