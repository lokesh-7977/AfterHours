import "server-only";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { errors, isDuplicateKeyError } from "@/lib/errors";
import { buildPage, paginationSchema, toSkip, type Paginated } from "@/lib/pagination";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { withTransaction } from "@/lib/transactions";
import { parseInput, optionalBlank } from "@/lib/validation";
import { assertAdmin, assertAuthenticated } from "@/modules/auth/policies";
import { isAdminRole, type SessionUser } from "@/modules/auth/roles";
import { recordAudit } from "@/modules/audit/audit.service";
import { eventRepository } from "@/modules/events/event.repository";
import { EventModel } from "@/modules/events/event.model";
import { isPubliclyVisible } from "@/modules/events/event.policy";
import { notify } from "@/modules/notifications/notification.service";
import { getUserSummaries } from "@/modules/users/user.service";
import { COMMENT_AUTO_HIDE_REPORTS, CommentModel, CommentReportModel, MAX_COMMENT_DEPTH, type CommentDoc, type CommentModerationStatus } from "./comment.model";

/** Plain text only; React escapes on render and no HTML is ever interpreted. */
const bodySchema = z.string().trim().min(1, "Write something").max(2000, "At most 2000 characters");

export const createCommentSchema = z.object({ body: bodySchema, parentId: optionalBlank(z.uuid()) });
export const editCommentSchema = z.object({ body: bodySchema });
export const reportCommentSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export interface CommentDTO {
  id: string;
  eventId: string;
  parentId: string | null;
  depth: number;
  body: string;
  author: { id: string; name: string } | null;
  isOwn: boolean;
  deleted: boolean;
  edited: boolean;
  moderationStatus: CommentModerationStatus;
  createdAt: string;
  replies: CommentDTO[];
}

export function canEditComment(actorId: string, comment: Pick<CommentDoc, "userId" | "deletedAt">): boolean {
  return comment.userId === actorId && !comment.deletedAt;
}

export function canDeleteComment(actor: Pick<SessionUser, "id" | "role">, comment: Pick<CommentDoc, "userId" | "deletedAt">): boolean {
  return !comment.deletedAt && (comment.userId === actor.id || isAdminRole(actor.role));
}

async function loadCommentableEvent(eventId: string) {
  const event = await eventRepository.findById(eventId);
  if (!event || !isPubliclyVisible(event)) throw errors.notFound("Event");
  return event;
}

export async function addComment(actor: SessionUser | null, eventId: string, rawInput: unknown): Promise<CommentDTO> {
  assertAuthenticated(actor);
  const input = parseInput(createCommentSchema, rawInput);
  await connectDB();
  await enforceRateLimit(`comment:${actor.id}`, RATE_LIMITS.comments);
  const event = await loadCommentableEvent(eventId);

  let depth = 0;
  let parentId: string | null = null;
  let rootId: string | null = null;
  let parent: CommentDoc | null = null;
  if (input.parentId) {
    parent = await CommentModel.findOne({ _id: input.parentId, eventId }).lean<CommentDoc>();
    if (!parent || parent.deletedAt || parent.moderationStatus === "rejected") throw errors.unprocessable("You cannot reply to this comment", "INVALID_PARENT");
    // Replies beyond the maximum depth attach to the deepest allowed ancestor to keep threads flat.
    if (parent.depth >= MAX_COMMENT_DEPTH) {
      parentId = parent.parentId;
      depth = parent.depth;
    } else {
      parentId = parent._id;
      depth = parent.depth + 1;
    }
    rootId = parent.rootId ?? parent._id;
  }
  const [doc] = await CommentModel.create([{ eventId, userId: actor.id, parentId, rootId, depth, body: input.body }]);
  if (parent && parent.userId !== actor.id) {
    await notify({
      userId: parent.userId,
      type: "comment_reply",
      title: `New reply on ${event.title}`,
      body: `${actor.name} replied: "${input.body.slice(0, 140)}"`,
      link: `/event/${event.slug}#comment-${doc._id}`,
      dedupeKey: `comment_reply:${doc._id}`,
      email: false,
    });
  }
  return { ...toDTO(doc.toObject() as CommentDoc, actor, new Map([[actor.id, { name: actor.name }]])), replies: [] };
}

function toDTO(c: CommentDoc, actor: Pick<SessionUser, "id" | "role"> | null, users: Map<string, { name: string }>): CommentDTO {
  const hidden = Boolean(c.deletedAt) || c.moderationStatus !== "approved";
  const admin = actor ? isAdminRole(actor.role) : false;
  const showBody = !hidden || (admin && !c.deletedAt);
  return {
    id: c._id,
    eventId: c.eventId,
    parentId: c.parentId,
    depth: c.depth,
    body: showBody ? c.body : c.deletedAt ? "[deleted]" : "[hidden by moderators]",
    author: showBody ? { id: c.userId, name: users.get(c.userId)?.name ?? "Member" } : null,
    isOwn: actor?.id === c.userId,
    deleted: Boolean(c.deletedAt),
    edited: Boolean(c.editedAt),
    moderationStatus: c.moderationStatus,
    createdAt: c.createdAt.toISOString(),
    replies: [],
  };
}

/** Top-level comments paginated; each carries its (bounded) reply thread. */
export async function listComments(actor: SessionUser | null, eventId: string, rawQuery: unknown): Promise<Paginated<CommentDTO>> {
  const query = parseInput(paginationSchema, rawQuery);
  await connectDB();
  // Listing only needs to know the event is public; avoid loading the full document.
  if (!(await EventModel.exists({ _id: eventId, deletedAt: null, status: { $ne: "draft" } }))) throw errors.notFound("Event");
  const filter = { eventId, parentId: null };
  const [roots, total] = await Promise.all([
    CommentModel.find(filter).sort({ createdAt: -1 }).skip(toSkip(query)).limit(query.pageSize).lean<CommentDoc[]>(),
    CommentModel.countDocuments(filter),
  ]);
  const replies = roots.length ? await CommentModel.find({ rootId: { $in: roots.map((r) => r._id) } }).sort({ createdAt: 1 }).limit(roots.length * 50).lean<CommentDoc[]>() : [];
  const all = [...roots, ...replies];
  const users = await getUserSummaries(all.map((c) => c.userId));
  const dtoById = new Map(all.map((c) => [c._id, toDTO(c, actor, users)]));
  for (const r of replies) {
    const parent = r.parentId ? dtoById.get(r.parentId) : undefined;
    if (parent) parent.replies.push(dtoById.get(r._id)!);
  }
  // Drop deleted leaf comments that have no replies.
  const prune = (list: CommentDTO[]): CommentDTO[] => list.filter((c) => !(c.deleted && c.replies.length === 0)).map((c) => ({ ...c, replies: prune(c.replies) }));
  return buildPage(prune(roots.map((r) => dtoById.get(r._id)!)), total, query);
}

export async function editComment(actor: SessionUser | null, commentId: string, rawInput: unknown): Promise<void> {
  assertAuthenticated(actor);
  const { body } = parseInput(editCommentSchema, rawInput);
  await connectDB();
  const comment = await CommentModel.findById(commentId).lean<CommentDoc>();
  if (!comment || !canEditComment(actor.id, comment)) throw errors.notFound("Comment");
  await CommentModel.updateOne({ _id: commentId, userId: actor.id, deletedAt: null }, { $set: { body, editedAt: new Date() } });
}

export async function deleteComment(actor: SessionUser | null, commentId: string): Promise<void> {
  assertAuthenticated(actor);
  await connectDB();
  const comment = await CommentModel.findById(commentId).lean<CommentDoc>();
  if (!comment || !canDeleteComment(actor, comment)) throw errors.notFound("Comment");
  await withTransaction(async (session) => {
    await CommentModel.updateOne({ _id: commentId, deletedAt: null }, { $set: { deletedAt: new Date(), deletedBy: actor.id } }, { session });
    if (comment.userId !== actor.id) {
      await recordAudit({ actor, action: "comment.admin_delete", entityType: "comment", entityId: commentId, eventId: comment.eventId }, session);
    }
  });
}

export async function reportComment(actor: SessionUser | null, commentId: string, rawInput: unknown): Promise<void> {
  assertAuthenticated(actor);
  const { reason } = parseInput(reportCommentSchema, rawInput);
  await connectDB();
  await enforceRateLimit(`report:${actor.id}`, RATE_LIMITS.reports);
  const comment = await CommentModel.findOne({ _id: commentId, deletedAt: null }).lean<CommentDoc>();
  if (!comment) throw errors.notFound("Comment");
  if (comment.userId === actor.id) throw errors.badRequest("You cannot report your own comment");
  try {
    await CommentReportModel.create({ commentId, eventId: comment.eventId, reporterId: actor.id, reason });
  } catch (err) {
    if (isDuplicateKeyError(err)) return; // already reported by this user
    throw err;
  }
  const updated = await CommentModel.findOneAndUpdate({ _id: commentId }, { $inc: { reportCount: 1 } }, { returnDocument: "after" }).lean<CommentDoc>();
  if (updated && updated.reportCount >= COMMENT_AUTO_HIDE_REPORTS && updated.moderationStatus === "approved") {
    await CommentModel.updateOne({ _id: commentId, moderationStatus: "approved" }, { $set: { moderationStatus: "pending" } });
  }
}

export const moderateCommentSchema = z.object({ decision: z.enum(["approved", "rejected"]) });

export async function moderateComment(actor: SessionUser | null, commentId: string, rawInput: unknown): Promise<void> {
  assertAdmin(actor);
  const { decision } = parseInput(moderateCommentSchema, rawInput);
  await connectDB();
  await withTransaction(async (session) => {
    const res = await CommentModel.updateOne({ _id: commentId }, { $set: { moderationStatus: decision, ...(decision === "approved" ? { reportCount: 0 } : {}) } }, { session });
    if (res.matchedCount === 0) throw errors.notFound("Comment");
    await CommentReportModel.updateMany({ commentId, resolvedAt: null }, { $set: { resolvedAt: new Date(), resolvedBy: actor.id } }, { session });
    await recordAudit({ actor, action: `comment.${decision === "approved" ? "approve" : "reject"}`, entityType: "comment", entityId: commentId }, session);
  });
}

export interface ReportedCommentDTO {
  id: string;
  eventId: string;
  body: string;
  author: string;
  reportCount: number;
  moderationStatus: CommentModerationStatus;
  reasons: string[];
  createdAt: string;
}

export const moderationQueueSchema = paginationSchema.extend({ scope: z.enum(["reported", "recent"]).default("reported") });

export async function listCommentsForModeration(actor: SessionUser | null, rawQuery: unknown): Promise<Paginated<ReportedCommentDTO>> {
  assertAdmin(actor);
  const query = parseInput(moderationQueueSchema, rawQuery);
  await connectDB();
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.scope === "reported") filter.$or = [{ reportCount: { $gt: 0 } }, { moderationStatus: "pending" }];
  const [docs, total] = await Promise.all([
    CommentModel.find(filter).sort(query.scope === "reported" ? { reportCount: -1, createdAt: -1 } : { createdAt: -1 }).skip(toSkip(query)).limit(query.pageSize).lean<CommentDoc[]>(),
    CommentModel.countDocuments(filter),
  ]);
  const [users, reports] = await Promise.all([
    getUserSummaries(docs.map((d) => d.userId)),
    CommentReportModel.find({ commentId: { $in: docs.map((d) => d._id) }, resolvedAt: null }).limit(500).lean(),
  ]);
  return buildPage(
    docs.map((d) => ({
      id: d._id,
      eventId: d.eventId,
      body: d.body,
      author: users.get(d.userId)?.email ?? "unknown",
      reportCount: d.reportCount,
      moderationStatus: d.moderationStatus,
      reasons: reports.filter((r) => r.commentId === d._id).map((r) => r.reason).slice(0, 5),
      createdAt: d.createdAt.toISOString(),
    })),
    total,
    query,
  );
}
