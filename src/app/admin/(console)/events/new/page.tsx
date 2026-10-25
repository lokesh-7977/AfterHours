import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/page-guards";
import { PageHeader } from "@/components/ui";
import { EventForm } from "@/components/admin/event-form";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireAdminPage();
  return (
    <div>
      <PageHeader title="New event" description="Events are created as drafts. Add a poster and publish from the event page." />
      <EventForm />
    </div>
  );
}
