"use client";

import { useActionState, useRef } from "react";
import { createEventAction, deleteEventAction, eventStatusAction, setPosterAction, updateEventAction } from "@/actions/events";
import { Field, FormMessage, SubmitButton, type ClientActionResult } from "@/components/form";
import { MediaUploader } from "@/components/media/media-uploader";
import { CATEGORY_LABELS, EVENT_CATEGORIES } from "@/modules/events/event.constants";
import { useRouter } from "next/navigation";
import { fromMinor } from "@/lib/money";

export interface EventFormValues {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  venueName: string;
  venueAddress: string;
  city: string;
  location: { lat: number; lng: number } | null;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  priceMinor: number;
  currency: string;
  capacity: number;
  paymentInstructions: string | null;
  attendanceSettings: { requireStaffConfirmation: boolean; allowCodeCheckIn: boolean };
  gallerySettings: { enabled: boolean; uploadsEnabled: boolean; autoApprove: boolean; maxUploadsPerUser: number };
}

const DATE_FIELDS = ["startsAt", "endsAt", "registrationOpensAt", "registrationClosesAt"] as const;

/** ISO -> value for <input type="datetime-local"> in the admin's local timezone. */
function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="hidden" name={name} value="false" />
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="h-4 w-4 accent-[var(--color-accent)]" />
      {label}
    </label>
  );
}

export function EventForm({ initial }: { initial?: EventFormValues }) {
  const action = initial?.id ? updateEventAction.bind(null, initial.id) : createEventAction;
  const [state, formAction] = useActionState(action, null);
  const s = state as ClientActionResult | null;
  const formRef = useRef<HTMLFormElement>(null);

  // datetime-local has no timezone; convert to absolute ISO in the browser before submitting.
  function submit(fd: FormData) {
    for (const f of DATE_FIELDS) {
      const local = fd.get(`${f}Local`);
      if (typeof local === "string" && local) fd.set(f, new Date(local).toISOString());
      fd.delete(`${f}Local`);
    }
    return formAction(fd);
  }

  return (
    <form ref={formRef} action={submit} className="space-y-6">
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Basics</h2>
        <div className="sm:col-span-2">
          <Field label="Title" name="title" state={s}>
            <input className="input" id="title" name="title" required minLength={3} maxLength={140} defaultValue={initial?.title} />
          </Field>
        </div>
        <Field label="Slug (optional)" name="slug" state={s} hint="Lowercase words separated by hyphens. Generated from the title if empty.">
          <input className="input" id="slug" name="slug" maxLength={80} defaultValue={initial?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        </Field>
        <Field label="Category" name="category" state={s}>
          <select className="input" id="category" name="category" defaultValue={initial?.category ?? "community"}>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Short summary" name="summary" state={s}>
            <input className="input" id="summary" name="summary" required minLength={10} maxLength={300} defaultValue={initial?.summary} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description" name="description" state={s}>
            <textarea className="input min-h-40" id="description" name="description" required minLength={20} maxLength={20000} defaultValue={initial?.description} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Tags" name="tags" state={s} hint="Comma separated, up to 10.">
            <input className="input" id="tags" name="tags" defaultValue={initial?.tags.join(", ")} />
          </Field>
        </div>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Venue</h2>
        <Field label="Venue name" name="venueName" state={s}>
          <input className="input" id="venueName" name="venueName" required defaultValue={initial?.venueName} />
        </Field>
        <Field label="City" name="city" state={s}>
          <input className="input" id="city" name="city" required defaultValue={initial?.city} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address" name="venueAddress" state={s}>
            <input className="input" id="venueAddress" name="venueAddress" required defaultValue={initial?.venueAddress} />
          </Field>
        </div>
        <Field label="Latitude (optional)" name="latitude" state={s}>
          <input className="input" id="latitude" name="latitude" type="number" step="any" min={-90} max={90} defaultValue={initial?.location?.lat} />
        </Field>
        <Field label="Longitude (optional)" name="longitude" state={s}>
          <input className="input" id="longitude" name="longitude" type="number" step="any" min={-180} max={180} defaultValue={initial?.location?.lng} />
        </Field>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Schedule</h2>
        {DATE_FIELDS.map((f) => (
          <Field key={f} label={{ startsAt: "Starts", endsAt: "Ends", registrationOpensAt: "Registration opens", registrationClosesAt: "Registration closes" }[f]} name={f} state={s}>
            <input className="input" id={f} name={`${f}Local`} type="datetime-local" required defaultValue={toLocalInput(initial?.[f])} />
          </Field>
        ))}
      </section>

      <section className="card grid gap-4 sm:grid-cols-3">
        <h2 className="font-semibold sm:col-span-3">Tickets & payment</h2>
        <Field label="Price (0 for free)" name="priceMinor" state={s}>
          <input className="input" id="price" name="price" type="number" min={0} step="0.01" required defaultValue={initial ? fromMinor(initial.priceMinor, initial.currency) : "0"} />
        </Field>
        <Field label="Currency" name="currency" state={s}>
          <input className="input uppercase" id="currency" name="currency" maxLength={3} defaultValue={initial?.currency ?? "INR"} />
        </Field>
        <Field label="Capacity" name="capacity" state={s}>
          <input className="input" id="capacity" name="capacity" type="number" min={1} max={100000} required defaultValue={initial?.capacity ?? 100} />
        </Field>
        <div className="sm:col-span-3">
          <Field label="Payment instructions shown to registrants" name="paymentInstructions" state={s} hint="e.g. UPI ID, bank details. Payments are verified manually.">
            <textarea className="input" id="paymentInstructions" name="paymentInstructions" maxLength={2000} defaultValue={initial?.paymentInstructions ?? ""} />
          </Field>
        </div>
      </section>

      <section className="card grid gap-3 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Attendance & gallery</h2>
        <Check name="allowCodeCheckIn" label="Allow check-in with a shared attendance code" defaultChecked={initial?.attendanceSettings.allowCodeCheckIn ?? true} />
        <Check name="requireStaffConfirmation" label="Code check-ins need staff confirmation (strict venue attendance)" defaultChecked={initial?.attendanceSettings.requireStaffConfirmation ?? false} />
        <Check name="galleryEnabled" label="Private attendee gallery enabled" defaultChecked={initial?.gallerySettings.enabled ?? true} />
        <Check name="galleryUploadsEnabled" label="Attendees can upload" defaultChecked={initial?.gallerySettings.uploadsEnabled ?? true} />
        <Check name="galleryAutoApprove" label="Auto-approve attendee uploads (skip moderation)" defaultChecked={initial?.gallerySettings.autoApprove ?? false} />
        <Field label="Max uploads per attendee" name="galleryMaxUploadsPerUser" state={s}>
          <input className="input" id="galleryMaxUploadsPerUser" name="galleryMaxUploadsPerUser" type="number" min={0} max={1000} defaultValue={initial?.gallerySettings.maxUploadsPerUser ?? 50} />
        </Field>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">{initial?.id ? "Save changes" : "Create draft"}</SubmitButton>
        <FormMessage state={s} />
      </div>
    </form>
  );
}

export function EventStatusControls({ eventId, status }: { eventId: string; status: string }) {
  const [state, action] = useActionState(eventStatusAction.bind(null, eventId), null);
  const [delState, delAction] = useActionState(deleteEventAction.bind(null, eventId), null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <form action={action}>
            <SubmitButton name="action" value="publish" pendingText="Publishing…">Publish</SubmitButton>
          </form>
        ) : null}
        {status === "published" ? (
          <form action={action}>
            <SubmitButton className="btn" name="action" value="complete" pendingText="…">Mark completed</SubmitButton>
          </form>
        ) : null}
        <form action={delAction} onSubmit={(e) => !confirm("Delete this event? It will be hidden everywhere.") && e.preventDefault()}>
          <SubmitButton className="btn btn-danger" pendingText="Deleting…">Delete</SubmitButton>
        </form>
      </div>
      {status === "draft" || status === "published" ? (
        <form action={action} className="flex gap-2" onSubmit={(e) => !confirm("Cancel this event and notify all registrants?") && e.preventDefault()}>
          <input type="hidden" name="action" value="cancel" />
          <input className="input" name="reason" placeholder="Cancellation reason" required minLength={3} maxLength={1000} />
          <SubmitButton className="btn btn-danger" pendingText="Cancelling…">Cancel event</SubmitButton>
        </form>
      ) : null}
      <FormMessage state={state as ClientActionResult | null} />
      <FormMessage state={delState as ClientActionResult | null} />
    </div>
  );
}

export function PosterManager({ eventId, posterUrl }: { eventId: string; posterUrl: string | null }) {
  const router = useRouter();
  return (
    <div className="space-y-3">
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl} alt="Poster" className="w-full rounded-lg border border-[var(--color-line)]" />
      ) : (
        <p className="muted text-sm">No poster yet.</p>
      )}
      <MediaUploader
        eventId={eventId}
        purpose="poster"
        label={posterUrl ? "Replace poster" : "Upload poster"}
        onUploaded={async (m) => {
          await setPosterAction(eventId, m.id);
          router.refresh();
        }}
      />
      {posterUrl ? (
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            await setPosterAction(eventId, null);
            router.refresh();
          }}
        >
          Remove poster
        </button>
      ) : null}
    </div>
  );
}
