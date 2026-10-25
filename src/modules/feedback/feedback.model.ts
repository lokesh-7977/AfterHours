import { Schema } from "mongoose";
import { defineModel, uuidPrimaryKey } from "@/lib/model";

export const FEEDBACK_STATUSES = ["pending", "approved", "rejected"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface FeedbackDoc {
  _id: string;
  eventId: string;
  userId: string;
  rating: number;
  body: string | null;
  status: FeedbackStatus;
  /** Private to admins; never serialized to participants or the public. */
  adminNote: string | null;
  revisionCount: number;
  moderatedBy: string | null;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<FeedbackDoc>(
  {
    _id: uuidPrimaryKey,
    eventId: { type: String, required: true },
    userId: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    body: { type: String, default: null, maxlength: 3000 },
    status: { type: String, enum: FEEDBACK_STATUSES, required: true, default: "pending" },
    adminNote: { type: String, default: null, maxlength: 1000 },
    revisionCount: { type: Number, required: true, default: 0 },
    moderatedBy: { type: String, default: null },
    moderatedAt: { type: Date, default: null },
  },
  { collection: "feedback", versionKey: false, timestamps: true },
);
// One feedback per participant per event; edits are tracked as revisions on the same record.
feedbackSchema.index({ eventId: 1, userId: 1 }, { unique: true });
feedbackSchema.index({ eventId: 1, status: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });

export const FeedbackModel = defineModel<FeedbackDoc>("Feedback", feedbackSchema);
