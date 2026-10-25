import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParticipantPage } from "@/lib/page-guards";
import { AppError } from "@/lib/errors";
import { isUuidV7 } from "@/lib/ids";
import { isR2Configured } from "@/lib/env";
import { eventRepository } from "@/modules/events/event.repository";
import { listGallery } from "@/modules/media/media.service";
import { Alert, Card, EmptyState, PageHeader, Pagination, sp } from "@/components/ui";
import { GalleryGrid } from "@/components/media/gallery-grid";
import { GalleryUploader } from "@/components/media/gallery-uploader";

export const metadata: Metadata = { title: "Event gallery" };

type Props = { params: Promise<{ eventId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EventGalleryPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const user = await requireParticipantPage(`/my-gallery/${eventId}`);
  if (!isUuidV7(eventId)) notFound();
  const query = await searchParams;
  const page = sp(query, "page") ?? "1";

  let gallery: Awaited<ReturnType<typeof listGallery>>;
  try {
    // Server-side attendance check for this specific event.
    gallery = await listGallery(user, eventId, { page, pageSize: 48 });
  } catch (err) {
    if (err instanceof AppError && (err.code === "FORBIDDEN" || err.code === "NOT_FOUND")) {
      return (
        <div className="container-page max-w-lg py-16">
          <Alert tone="amber">This gallery is available only to verified attendees of the event.</Alert>
          <Link className="link mt-4 inline-block text-sm" href="/my-gallery">← Your galleries</Link>
        </div>
      );
    }
    throw err;
  }
  const event = await eventRepository.findById(eventId);
  const uploadsOpen = Boolean(event?.gallerySettings?.uploadsEnabled) && isR2Configured();

  return (
    <div className="container-page py-10">
      <PageHeader
        title={event?.title ?? "Gallery"}
        description="Shared privately with verified attendees. Uploads are reviewed before others can see them."
        actions={<Link href="/my-gallery" className="btn btn-sm">All galleries</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {gallery.items.length === 0 ? <EmptyState title="No photos or videos yet">Be the first to share a moment.</EmptyState> : <GalleryGrid items={gallery.items} />}
          <Pagination page={gallery.page} totalPages={gallery.totalPages} basePath={`/my-gallery/${eventId}`} params={{}} />
        </div>
        <Card className="h-fit">
          <h2 className="mb-2 font-semibold">Share your photos & videos</h2>
          {uploadsOpen ? (
            <GalleryUploader eventId={eventId} />
          ) : (
            <p className="muted text-sm">Uploads are currently closed for this gallery.</p>
          )}
          <p className="muted mt-3 text-xs">Only upload media you have the right to share, and respect people who prefer not to be photographed. Anyone can request removal via “Report”.</p>
        </Card>
      </div>
    </div>
  );
}
