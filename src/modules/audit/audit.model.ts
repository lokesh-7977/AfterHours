import { Schema } from "mongoose";
import { defineModel, uuidPrimaryKey } from "@/lib/model";

export interface AuditLogDoc {
  _id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  eventId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: Date;
}

const auditSchema = new Schema<AuditLogDoc>(
  {
    _id: uuidPrimaryKey,
    actorId: { type: String, default: null },
    actorRole: { type: String, default: null },
    action: { type: String, required: true, maxlength: 100 },
    entityType: { type: String, required: true, maxlength: 50 },
    entityId: { type: String, default: null },
    eventId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
  },
  { collection: "audit_logs", versionKey: false, timestamps: { createdAt: true, updatedAt: false } },
);
auditSchema.index({ createdAt: -1 });
auditSchema.index({ eventId: 1, createdAt: -1 });
auditSchema.index({ actorId: 1, createdAt: -1 });
auditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditSchema.index({ action: 1, createdAt: -1 });

export const AuditLogModel = defineModel<AuditLogDoc>("AuditLog", auditSchema);
