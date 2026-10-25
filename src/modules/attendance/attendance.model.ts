import { Schema } from "mongoose";
import { defineModel, uuidPrimaryKey } from "@/lib/model";

export const ATTENDANCE_METHODS = ["qr_scan", "code", "manual"] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];

export const ATTENDANCE_STATUSES = ["verified", "pending_confirmation", "revoked"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceDoc {
  _id: string;
  eventId: string;
  userId: string;
  registrationId: string;
  passId: string;
  method: AttendanceMethod;
  status: AttendanceStatus;
  attendanceCodeId: string | null;
  verifiedBy: string | null;
  checkedInAt: Date;
  confirmedAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  revocationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<AttendanceDoc>(
  {
    _id: uuidPrimaryKey,
    eventId: { type: String, required: true },
    userId: { type: String, required: true },
    registrationId: { type: String, required: true },
    passId: { type: String, required: true },
    method: { type: String, enum: ATTENDANCE_METHODS, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    attendanceCodeId: { type: String, default: null },
    verifiedBy: { type: String, default: null },
    checkedInAt: { type: Date, required: true },
    confirmedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: String, default: null },
    revocationReason: { type: String, default: null, maxlength: 500 },
  },
  { collection: "attendances", versionKey: false, timestamps: true },
);
// Atomic duplicate check-in protection: at most one attendance record per participant per event.
attendanceSchema.index({ eventId: 1, userId: 1 }, { unique: true });
attendanceSchema.index({ eventId: 1, status: 1, checkedInAt: -1 });
attendanceSchema.index({ userId: 1, status: 1 });
attendanceSchema.index({ checkedInAt: -1 });

export const AttendanceModel = defineModel<AttendanceDoc>("Attendance", attendanceSchema);

export interface AttendanceCodeDoc {
  _id: string;
  eventId: string;
  /** HMAC of the normalized code; plaintext is shown once at creation. */
  codeHash: string;
  label: string | null;
  createdBy: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
  maxUses: number | null;
  useCount: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceCodeSchema = new Schema<AttendanceCodeDoc>(
  {
    _id: uuidPrimaryKey,
    eventId: { type: String, required: true },
    codeHash: { type: String, required: true },
    label: { type: String, default: null, maxlength: 80 },
    createdBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: String, default: null },
    maxUses: { type: Number, default: null, min: 1 },
    useCount: { type: Number, required: true, default: 0, min: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { collection: "attendance_codes", versionKey: false, timestamps: true },
);
attendanceCodeSchema.index({ eventId: 1, codeHash: 1 }, { unique: true });
attendanceCodeSchema.index({ eventId: 1, createdAt: -1 });

export const AttendanceCodeModel = defineModel<AttendanceCodeDoc>("AttendanceCode", attendanceCodeSchema);
