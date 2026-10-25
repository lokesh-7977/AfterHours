import { Schema } from "mongoose";
import { defineModel, uuidPrimaryKey } from "@/lib/model";

export const COMMENT_MODERATION_STATUSES = ["approved", "pending", "rejected"] as const;
export type CommentModerationStatus = (typeof COMMENT_MODERATION_STATUSES)[number];

/** comment (0) -> reply (1) -> reply (2); deeper replies attach to depth 2's parent thread. */
export const MAX_COMMENT_DEPTH = 2;
export const COMMENT_AUTO_HIDE_REPORTS = 5;

export interface CommentDoc {
  _id: string;
  eventId: string;
  userId: string;
  parentId: string | null;
  rootId: string | null;
  depth: number;
  body: string;
  moderationStatus: CommentModerationStatus;
  reportCount: number;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<CommentDoc>(
  {
    _id: uuidPrimaryKey,
    eventId: { type: String, required: true },
    userId: { type: String, required: true },
    parentId: { type: String, default: null },
    rootId: { type: String, default: null },
    depth: { type: Number, required: true, min: 0, max: MAX_COMMENT_DEPTH },
    body: { type: String, required: true, maxlength: 2000 },
    moderationStatus: { type: String, enum: COMMENT_MODERATION_STATUSES, required: true, default: "approved" },
    reportCount: { type: Number, required: true, default: 0, min: 0 },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  { collection: "comments", versionKey: false, timestamps: true },
);
commentSchema.index({ eventId: 1, parentId: 1, createdAt: -1 });
commentSchema.index({ rootId: 1, createdAt: 1 });
commentSchema.index({ moderationStatus: 1, reportCount: -1, createdAt: -1 });
commentSchema.index({ createdAt: -1 });

export const CommentModel = defineModel<CommentDoc>("Comment", commentSchema);

export interface CommentReportDoc {
  _id: string;
  commentId: string;
  eventId: string;
  reporterId: string;
  reason: string;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
}

const reportSchema = new Schema<CommentReportDoc>(
  {
    _id: uuidPrimaryKey,
    commentId: { type: String, required: true },
    eventId: { type: String, required: true },
    reporterId: { type: String, required: true },
    reason: { type: String, required: true, maxlength: 500 },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
  },
  { collection: "comment_reports", versionKey: false, timestamps: { createdAt: true, updatedAt: false } },
);
reportSchema.index({ commentId: 1, reporterId: 1 }, { unique: true });
reportSchema.index({ resolvedAt: 1, createdAt: -1 });

export const CommentReportModel = defineModel<CommentReportDoc>("CommentReport", reportSchema);
