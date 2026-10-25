import { apiRoute, ok, readId, readJson } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { z } from "zod";
import { cancelEvent, completeEvent, publishEvent } from "@/modules/events/event.service";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("cancel"), reason: z.string() }),
]);

export const POST = apiRoute<{ eventId: string }>(async (req, { params }) => {
  const user = await getSessionUser();
  const eventId = readId(params.eventId, "Event");
  const input = await readJson(req, body);
  if (input.action === "publish") return ok(await publishEvent(user, eventId));
  if (input.action === "complete") return ok(await completeEvent(user, eventId));
  return ok(await cancelEvent(user, eventId, { reason: input.reason }));
});
