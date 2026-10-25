"use client";

import { useRouter } from "next/navigation";
import { MediaUploader } from "./media-uploader";

export function GalleryUploader({ eventId }: { eventId: string }) {
  const router = useRouter();
  return <MediaUploader eventId={eventId} purpose="gallery" multiple label="Upload photos / videos" onUploaded={() => router.refresh()} />;
}
