import { Schema } from "mongoose";
import { defineModel, uuidPrimaryKey } from "@/lib/model";

export interface EventInterestDoc {
  _id: string;
  eventId: string;
  userId: string;
  createdAt: Date;
}

const interestSchema = new Schema<EventInterestDoc>(
  {
    _id: uuidPrimaryKey,
    eventId: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { collection: "event_interests", versionKey: false, timestamps: { createdAt: true, updatedAt: false } },
);
interestSchema.index({ eventId: 1, userId: 1 }, { unique: true });
interestSchema.index({ userId: 1, createdAt: -1 });

export const EventInterestModel = defineModel<EventInterestDoc>("EventInterest", interestSchema);
