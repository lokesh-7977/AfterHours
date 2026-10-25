import "server-only";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { logger } from "@/lib/logger";
import { buildPage, paginationSchema, toSkip, type Paginated } from "@/lib/pagination";
import type { TxSession } from "@/lib/transactions";
import type { SessionUser } from "@/modules/auth/roles";
import { AuditLogModel } from "./audit.model";

export interface AuditEntry {
  actor: Pick<SessionUser, "id" | "role"> | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  eventId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Append an audit record. When a transaction session is supplied the record
 * commits atomically with the change it describes.
 */
export async function recordAudit(entry: AuditEntry, session?: TxSession): Promise<void> {
  await connectDB();
  await AuditLogModel.create(
    [
      {
        actorId: entry.actor?.id ?? null,
        actorRole: entry.actor?.role ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        eventId: entry.eventId ?? null,
        metadata: entry.metadata ?? {},
        ip: entry.ip ?? null,
      },
    ],
    { session },
  );
}

/** Best-effort audit for read-type activity (downloads) where failure must not block the user. */
export async function recordAuditSafe(entry: AuditEntry): Promise<void> {
  try {
    await recordAudit(entry);
  } catch (err) {
    logger.error("audit.write_failed", { action: entry.action, err });
  }
}

export const auditQuerySchema = paginationSchema.extend({
  action: z.string().trim().max(100).optional(),
  eventId: z.uuid().optional(),
  actorId: z.uuid().optional(),
  entityType: z.string().trim().max(50).optional(),
});

export interface AuditLogDTO {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  eventId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function listAuditLogs(query: z.infer<typeof auditQuerySchema>): Promise<Paginated<AuditLogDTO>> {
  await connectDB();
  const filter: Record<string, string> = {};
  if (query.action) filter.action = query.action;
  if (query.eventId) filter.eventId = query.eventId;
  if (query.actorId) filter.actorId = query.actorId;
  if (query.entityType) filter.entityType = query.entityType;
  const [docs, total] = await Promise.all([
    AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(toSkip(query)).limit(query.pageSize).lean(),
    AuditLogModel.countDocuments(filter),
  ]);
  return buildPage(
    docs.map((d) => ({
      id: d._id,
      actorId: d.actorId,
      actorRole: d.actorRole,
      action: d.action,
      entityType: d.entityType,
      entityId: d.entityId,
      eventId: d.eventId,
      metadata: d.metadata ?? {},
      createdAt: d.createdAt.toISOString(),
    })),
    total,
    query,
  );
}
