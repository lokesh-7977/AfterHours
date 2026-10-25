/**
 * Create/verify all MongoDB indexes. Run during deployment (`pnpm db:indexes`)
 * rather than on application start-up. `createIndexes` only adds missing
 * indexes; it never drops existing ones (Better Auth's own indexes are safe).
 */
import { connectDB, disconnectDB } from "@/lib/db";
import { RateLimitBucketModel } from "@/lib/rate-limit";
import { UserModel } from "@/modules/users/user.model";
import { EventModel } from "@/modules/events/event.model";
import { EventInterestModel } from "@/modules/interests/interest.model";
import { RegistrationModel } from "@/modules/registrations/registration.model";
import { PassModel } from "@/modules/passes/pass.model";
import { AttendanceCodeModel, AttendanceModel } from "@/modules/attendance/attendance.model";
import { EventMediaModel } from "@/modules/media/media.model";
import { CommentModel, CommentReportModel } from "@/modules/comments/comment.model";
import { FeedbackModel } from "@/modules/feedback/feedback.model";
import { NotificationModel } from "@/modules/notifications/notification.model";
import { AuditLogModel } from "@/modules/audit/audit.model";

const models = [
  UserModel,
  EventModel,
  EventInterestModel,
  RegistrationModel,
  PassModel,
  AttendanceModel,
  AttendanceCodeModel,
  EventMediaModel,
  CommentModel,
  CommentReportModel,
  FeedbackModel,
  NotificationModel,
  AuditLogModel,
  RateLimitBucketModel,
];

async function main() {
  await connectDB();
  for (const model of models) {
    await model.createCollection().catch(() => undefined); // already exists
    await model.createIndexes();
    const indexes = await model.collection.indexes();
    console.log(`${model.collection.collectionName}: ${indexes.length} indexes`);
  }
  console.log("Indexes are in place.");
}

main()
  .catch((err) => {
    console.error("Index creation failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
