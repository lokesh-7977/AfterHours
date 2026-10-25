import { isAdminRole, type Role } from "@/modules/auth/roles";
import type { MediaPurpose, ModerationStatus, ProcessingStatus } from "./media.constants";

export interface MediaAccessFacts {
  actor: { id: string; role: Role } | null;
  media: {
    purpose: MediaPurpose;
    uploaderId: string;
    processingStatus: ProcessingStatus;
    moderationStatus: ModerationStatus;
    deletedAt: Date | null;
  };
  /** Event is published/cancelled/completed and not deleted. */
  eventPubliclyVisible: boolean;
  galleryEnabled: boolean;
  /** Actor has a *verified* attendance record for the media's own event. */
  actorIsVerifiedAttendee: boolean;
}

/** "public" may be cached by shared caches; "private" must never be. */
export type MediaAccess = "public" | "private" | null;

/**
 * Single read-authorization rule for every media operation (listing,
 * thumbnails, originals, video playback and range requests, downloads).
 */
export function mediaReadAccess(f: MediaAccessFacts): MediaAccess {
  const { actor, media } = f;
  if (media.deletedAt) return null;
  const admin = actor ? isAdminRole(actor.role) : false;
  if (admin) return media.processingStatus === "ready" ? "private" : null;
  if (media.processingStatus !== "ready") return null;

  switch (media.purpose) {
    case "poster":
    case "promo":
      return f.eventPubliclyVisible && media.moderationStatus === "approved" ? "public" : null;
    case "payment_proof":
      return actor && actor.id === media.uploaderId ? "private" : null;
    case "gallery": {
      if (!actor || !f.actorIsVerifiedAttendee || !f.galleryEnabled) return null;
      if (media.moderationStatus === "approved") return "private";
      // Uploaders can preview their own pending/rejected items.
      return actor.id === media.uploaderId ? "private" : null;
    }
  }
}

/** Who may initiate an upload for a purpose (attendance/ownership checked separately). */
export function canUploadPurpose(role: Role, purpose: MediaPurpose): boolean {
  if (purpose === "poster" || purpose === "promo") return isAdminRole(role);
  if (purpose === "payment_proof") return role === "participant";
  return true; // gallery: participants (verified attendance) and admins
}

export function initialModerationStatus(purpose: MediaPurpose, uploaderRole: Role, galleryAutoApprove: boolean): ModerationStatus {
  if (purpose !== "gallery") return "approved"; // admin assets & private payment proofs
  if (isAdminRole(uploaderRole) || galleryAutoApprove) return "approved";
  return "pending";
}
