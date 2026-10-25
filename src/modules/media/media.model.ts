import { Schema } from "mongoose";
import { defineModel, uuidPrimaryKey } from "@/lib/model";
import {
  ALLOWED_MIME_TYPES,
  MEDIA_PURPOSES,
  MEDIA_TYPES,
  MODERATION_STATUSES,
  PROCESSING_STATUSES,
  type MediaPurpose,
  type MediaType,
  type ModerationStatus,
  type ProcessingStatus,
} from "./media.constants";

export interface EventMediaDoc {
  _id: string;
  eventId: string;
  uploaderId: string;
  purpose: MediaPurpose;
  /** Payment proofs are bound to the registration they evidence. */
  registrationId: string | null;
  /** Server-generated random object key. Never accepted from clients, never returned to them. */
  storageKey: string;
  thumbnailKey: string | null;
  mediaType: MediaType;
  mimeType: string;
  declaredSize: number;
  sizeBytes: number | null;
  originalFilename: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  multipartUploadId: string | null;
  processingStatus: ProcessingStatus;
  uploadCompletedAt: Date | null;
  failureReason: string | null;
  moderationStatus: ModerationStatus;
  moderatedBy: string | null;
  moderatedAt: Date | null;
  moderationReason: string | null;
  reportCount: number;
  deletedAt: Date | null;
  deletedBy: string | null;
  /** Set once the R2 objects have been removed. */
  purgedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<EventMediaDoc>(
  {
    _id: uuidPrimaryKey,
    eventId: { type: String, required: true },
    uploaderId: { type: String, required: true },
    purpose: { type: String, enum: MEDIA_PURPOSES, required: true },
    registrationId: { type: String, default: null },
    storageKey: { type: String, required: true },
    thumbnailKey: { type: String, default: null },
    mediaType: { type: String, enum: MEDIA_TYPES, required: true },
    mimeType: { type: String, enum: ALLOWED_MIME_TYPES, required: true },
    declaredSize: { type: Number, required: true, min: 1 },
    sizeBytes: { type: Number, default: null },
    originalFilename: { type: String, required: true, maxlength: 200 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    durationSeconds: { type: Number, default: null },
    multipartUploadId: { type: String, default: null },
    processingStatus: { type: String, enum: PROCESSING_STATUSES, required: true, default: "pending" },
    uploadCompletedAt: { type: Date, default: null },
    failureReason: { type: String, default: null, maxlength: 300 },
    moderationStatus: { type: String, enum: MODERATION_STATUSES, required: true, default: "pending" },
    moderatedBy: { type: String, default: null },
    moderatedAt: { type: Date, default: null },
    moderationReason: { type: String, default: null, maxlength: 500 },
    reportCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    purgedAt: { type: Date, default: null },
  },
  { collection: "event_media", versionKey: false, timestamps: true },
);
mediaSchema.index({ storageKey: 1 }, { unique: true });
mediaSchema.index({ eventId: 1, purpose: 1, moderationStatus: 1, deletedAt: 1, createdAt: -1 });
mediaSchema.index({ uploaderId: 1, eventId: 1, purpose: 1, deletedAt: 1 });
mediaSchema.index({ processingStatus: 1, createdAt: 1 });
mediaSchema.index({ moderationStatus: 1, processingStatus: 1, createdAt: -1 });
mediaSchema.index({ purgedAt: 1, deletedAt: 1 });

export const EventMediaModel = defineModel<EventMediaDoc>("EventMedia", mediaSchema);
