import { Schema } from "mongoose";
import { defineModel, uuidPrimaryKey } from "@/lib/model";

export const NOTIFICATION_TYPES = [
  "registration_confirmed",
  "payment_submitted",
  "payment_approved",
  "payment_rejected",
  "payment_refunded",
  "pass_issued",
  "pass_revoked",
  "event_cancelled",
  "event_reminder",
  "attendance_verified",
  "media_moderated",
  "comment_reply",
  "admin_payment_submitted",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const EMAIL_DELIVERY_STATUSES = ["pending", "sent", "failed", "skipped"] as const;
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

export interface NotificationDoc {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  /** Idempotency key: retried operations cannot create duplicate notifications. */
  dedupeKey: string;
  readAt: Date | null;
  email: {
    status: EmailDeliveryStatus;
    attempts: number;
    lastError: string | null;
    nextAttemptAt: Date | null;
    sentAt: Date | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    _id: uuidPrimaryKey,
    userId: { type: String, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 2000 },
    link: { type: String, default: null },
    dedupeKey: { type: String, required: true },
    readAt: { type: Date, default: null },
    email: {
      status: { type: String, enum: EMAIL_DELIVERY_STATUSES, default: "pending" },
      attempts: { type: Number, default: 0 },
      lastError: { type: String, default: null },
      nextAttemptAt: { type: Date, default: () => new Date() },
      sentAt: { type: Date, default: null },
    },
  },
  { collection: "notifications", versionKey: false, timestamps: true },
);
notificationSchema.index({ dedupeKey: 1 }, { unique: true });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index({ "email.status": 1, "email.nextAttemptAt": 1 });

export const NotificationModel = defineModel<NotificationDoc>("Notification", notificationSchema);
