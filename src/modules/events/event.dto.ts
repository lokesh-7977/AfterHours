import { iso } from "@/lib/model";
import type { EventCategory, EventStatus } from "./event.constants";
import type { EventDoc } from "./event.model";
import { registrationBlockReason, type RegistrationBlockReason } from "./event.policy";

export function mediaContentUrl(mediaId: string, variant: "original" | "thumbnail" = "original"): string {
  return `/api/v1/media/${mediaId}/content${variant === "thumbnail" ? "?variant=thumbnail" : ""}`;
}

export interface EventSummaryDTO {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: EventCategory;
  tags: string[];
  city: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  priceMinor: number;
  currency: string;
  capacity: number;
  registeredCount: number;
  spotsLeft: number;
  interestCount: number;
  status: EventStatus;
  posterUrl: string | null;
  posterThumbUrl: string | null;
  cancellationReason: string | null;
}

export interface EventDetailDTO extends EventSummaryDTO {
  description: string;
  venueAddress: string;
  location: { lat: number; lng: number } | null;
  registrationOpensAt: string;
  registrationClosesAt: string;
  paymentInstructions: string | null;
  promoImageUrls: string[];
  publishedAt: string | null;
  registrationBlockedReason: RegistrationBlockReason | null;
  galleryEnabled: boolean;
  allowCodeCheckIn: boolean;
}

export interface EventAdminDTO extends EventDetailDTO {
  createdBy: string;
  posterMediaId: string | null;
  promoMediaIds: string[];
  attendanceSettings: EventDoc["attendanceSettings"];
  gallerySettings: EventDoc["gallerySettings"];
  cancelledAt: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toEventSummary(e: EventDoc): EventSummaryDTO {
  return {
    id: e._id,
    slug: e.slug,
    title: e.title,
    summary: e.summary,
    category: e.category,
    tags: e.tags ?? [],
    city: e.city,
    venueName: e.venueName,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    priceMinor: e.priceMinor,
    currency: e.currency,
    capacity: e.capacity,
    registeredCount: e.registeredCount,
    spotsLeft: Math.max(0, e.capacity - e.registeredCount),
    interestCount: e.interestCount,
    status: e.status,
    posterUrl: e.posterMediaId ? mediaContentUrl(e.posterMediaId) : null,
    posterThumbUrl: e.posterMediaId ? mediaContentUrl(e.posterMediaId, "thumbnail") : null,
    cancellationReason: e.cancellationReason ?? null,
  };
}

export function toEventDetail(e: EventDoc, now = new Date()): EventDetailDTO {
  return {
    ...toEventSummary(e),
    description: e.description,
    venueAddress: e.venueAddress,
    location: e.location ? { lat: e.location.lat, lng: e.location.lng } : null,
    registrationOpensAt: e.registrationOpensAt.toISOString(),
    registrationClosesAt: e.registrationClosesAt.toISOString(),
    paymentInstructions: e.paymentInstructions ?? null,
    promoImageUrls: (e.promoMediaIds ?? []).map((id) => mediaContentUrl(id)),
    publishedAt: iso(e.publishedAt),
    registrationBlockedReason: registrationBlockReason(e, now),
    galleryEnabled: e.gallerySettings?.enabled ?? true,
    allowCodeCheckIn: e.attendanceSettings?.allowCodeCheckIn ?? true,
  };
}

export function toEventAdmin(e: EventDoc): EventAdminDTO {
  return {
    ...toEventDetail(e),
    createdBy: e.createdBy,
    posterMediaId: e.posterMediaId ?? null,
    promoMediaIds: e.promoMediaIds ?? [],
    attendanceSettings: {
      requireStaffConfirmation: e.attendanceSettings?.requireStaffConfirmation ?? false,
      allowCodeCheckIn: e.attendanceSettings?.allowCodeCheckIn ?? true,
    },
    gallerySettings: {
      enabled: e.gallerySettings?.enabled ?? true,
      uploadsEnabled: e.gallerySettings?.uploadsEnabled ?? true,
      autoApprove: e.gallerySettings?.autoApprove ?? false,
      maxUploadsPerUser: e.gallerySettings?.maxUploadsPerUser ?? 50,
    },
    cancelledAt: iso(e.cancelledAt),
    completedAt: iso(e.completedAt),
    deletedAt: iso(e.deletedAt),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}
