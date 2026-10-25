import { Schema } from "mongoose";
import { defineModel, uuidPrimaryKey } from "@/lib/model";
import { EVENT_CATEGORIES, EVENT_STATUSES, type EventCategory, type EventStatus } from "./event.constants";

export interface EventGallerySettings {
  enabled: boolean;
  uploadsEnabled: boolean;
  autoApprove: boolean;
  maxUploadsPerUser: number;
}

export interface EventAttendanceSettings {
  /** Shared-code check-ins stay pending until staff confirm them (strict venue attendance). */
  requireStaffConfirmation: boolean;
  allowCodeCheckIn: boolean;
}

export interface EventDoc {
  _id: string;
  createdBy: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  category: EventCategory;
  tags: string[];
  posterMediaId: string | null;
  promoMediaIds: string[];
  venueName: string;
  venueAddress: string;
  city: string;
  location: { lat: number; lng: number } | null;
  startsAt: Date;
  endsAt: Date;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  priceMinor: number;
  currency: string;
  capacity: number;
  /** Seats held by active registrations; changed only with atomic $inc guarded by capacity. */
  registeredCount: number;
  interestCount: number;
  paymentInstructions: string | null;
  status: EventStatus;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  completedAt: Date | null;
  attendanceSettings: EventAttendanceSettings;
  gallerySettings: EventGallerySettings;
  deletedAt: Date | null;
  deletedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<EventDoc>(
  {
    _id: uuidPrimaryKey,
    createdBy: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 100 },
    summary: { type: String, required: true, maxlength: 300 },
    description: { type: String, required: true, maxlength: 20000 },
    category: { type: String, enum: EVENT_CATEGORIES, required: true },
    tags: { type: [String], default: [] },
    posterMediaId: { type: String, default: null },
    promoMediaIds: { type: [String], default: [] },
    venueName: { type: String, required: true, maxlength: 140 },
    venueAddress: { type: String, required: true, maxlength: 300 },
    city: { type: String, required: true, maxlength: 80 },
    location: {
      type: new Schema({ lat: { type: Number, min: -90, max: 90 }, lng: { type: Number, min: -180, max: 180 } }, { _id: false }),
      default: null,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    registrationOpensAt: { type: Date, required: true },
    registrationClosesAt: { type: Date, required: true },
    priceMinor: { type: Number, required: true, min: 0, validate: Number.isInteger },
    currency: { type: String, required: true, default: "INR", uppercase: true, match: /^[A-Z]{3}$/ },
    capacity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    registeredCount: { type: Number, required: true, default: 0, min: 0 },
    interestCount: { type: Number, required: true, default: 0, min: 0 },
    paymentInstructions: { type: String, default: null, maxlength: 2000 },
    status: { type: String, enum: EVENT_STATUSES, required: true, default: "draft" },
    publishedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: null },
    cancellationReason: { type: String, default: null, maxlength: 1000 },
    completedAt: { type: Date, default: null },
    attendanceSettings: {
      requireStaffConfirmation: { type: Boolean, default: false },
      allowCodeCheckIn: { type: Boolean, default: true },
    },
    gallerySettings: {
      enabled: { type: Boolean, default: true },
      uploadsEnabled: { type: Boolean, default: true },
      autoApprove: { type: Boolean, default: false },
      maxUploadsPerUser: { type: Number, default: 50, min: 0, max: 1000 },
    },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  { collection: "events", versionKey: false, timestamps: true },
);

eventSchema.index({ slug: 1 }, { unique: true });
eventSchema.index({ status: 1, deletedAt: 1, startsAt: 1 });
eventSchema.index({ city: 1, startsAt: 1 });
eventSchema.index({ category: 1, startsAt: 1 });
eventSchema.index({ createdBy: 1, createdAt: -1 });
eventSchema.index({ title: "text", summary: "text", tags: "text", city: "text" }, { name: "event_text_search", weights: { title: 10, tags: 5, summary: 2, city: 2 } });

export const EventModel = defineModel<EventDoc>("Event", eventSchema);
