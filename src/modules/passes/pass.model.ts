import { Schema } from "mongoose";
import { defineModel, uuidPrimaryKey } from "@/lib/model";

export const PASS_STATUSES = ["active", "revoked"] as const;
export type PassStatus = (typeof PASS_STATUSES)[number];

export interface PassDoc {
  _id: string;
  registrationId: string;
  eventId: string;
  userId: string;
  /** SHA-256 of the opaque QR token; the lookup key at scan time. */
  tokenHash: string;
  /** AES-256-GCM encrypted token so only the owner/admin can re-render the QR. */
  tokenCiphertext: string;
  status: PassStatus;
  issuedAt: Date;
  issuedBy: string | null;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  revocationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const passSchema = new Schema<PassDoc>(
  {
    _id: uuidPrimaryKey,
    registrationId: { type: String, required: true },
    eventId: { type: String, required: true },
    userId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    tokenCiphertext: { type: String, required: true },
    status: { type: String, enum: PASS_STATUSES, required: true, default: "active" },
    issuedAt: { type: Date, required: true, default: () => new Date() },
    issuedBy: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: String, default: null },
    revocationReason: { type: String, default: null, maxlength: 500 },
  },
  { collection: "passes", versionKey: false, timestamps: true },
);
// One pass per registration: repeated approvals can never mint a second pass.
passSchema.index({ registrationId: 1 }, { unique: true });
passSchema.index({ tokenHash: 1 }, { unique: true });
passSchema.index({ userId: 1, issuedAt: -1 });
passSchema.index({ eventId: 1, status: 1 });

export const PassModel = defineModel<PassDoc>("Pass", passSchema);
