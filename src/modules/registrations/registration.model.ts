import { Schema } from "mongoose";
import { defineModel, uuidPrimaryKey } from "@/lib/model";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  REGISTRATION_STATUSES,
  type PaymentMethod,
  type PaymentStatus,
  type RegistrationStatus,
} from "./registration.constants";

export interface RefundInfo {
  refundedAt: Date;
  refundedBy: string;
  reason: string | null;
  amountMinor: number;
}

export interface RegistrationDoc {
  _id: string;
  eventId: string;
  userId: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  /** Price snapshot at registration time, in minor units. */
  amountMinor: number;
  currency: string;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  paymentNote: string | null;
  paymentProofMediaId: string | null;
  paymentSubmittedAt: Date | null;
  paymentVerifiedBy: string | null;
  paymentVerifiedAt: Date | null;
  rejectionReason: string | null;
  refund: RefundInfo | null;
  /** True while this registration holds one unit of the event's registeredCount. */
  seatHeld: boolean;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const registrationSchema = new Schema<RegistrationDoc>(
  {
    _id: uuidPrimaryKey,
    eventId: { type: String, required: true },
    userId: { type: String, required: true },
    status: { type: String, enum: REGISTRATION_STATUSES, required: true, default: "registered" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, required: true, default: "pending" },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    paymentMethod: { type: String, enum: [...PAYMENT_METHODS, null], default: null },
    paymentReference: { type: String, default: null, maxlength: 120 },
    paymentNote: { type: String, default: null, maxlength: 1000 },
    paymentProofMediaId: { type: String, default: null },
    paymentSubmittedAt: { type: Date, default: null },
    paymentVerifiedBy: { type: String, default: null },
    paymentVerifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, maxlength: 1000 },
    refund: {
      type: new Schema<RefundInfo>(
        {
          refundedAt: { type: Date, required: true },
          refundedBy: { type: String, required: true },
          reason: { type: String, default: null },
          amountMinor: { type: Number, required: true, min: 0 },
        },
        { _id: false },
      ),
      default: null,
    },
    seatHeld: { type: Boolean, required: true, default: true },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: null },
    cancellationReason: { type: String, default: null, maxlength: 1000 },
  },
  { collection: "registrations", versionKey: false, timestamps: true },
);
// One registration document per participant per event (re-registration reactivates it).
registrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
registrationSchema.index({ eventId: 1, paymentStatus: 1, createdAt: -1 });
registrationSchema.index({ paymentStatus: 1, updatedAt: -1 });
registrationSchema.index({ userId: 1, createdAt: -1 });
registrationSchema.index({ paymentVerifiedAt: -1 });

export const RegistrationModel = defineModel<RegistrationDoc>("Registration", registrationSchema);
