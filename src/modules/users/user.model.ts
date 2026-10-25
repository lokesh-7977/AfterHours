import { Schema } from "mongoose";
import { defineModel } from "@/lib/model";
import { ROLES, type Role } from "@/modules/auth/roles";

/**
 * Read/role-management view of Better Auth's `user` collection. Better Auth
 * owns the document lifecycle (sign-up, verification, password); the app only
 * changes `role`, `name` and `phone` here.
 */
export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: Role;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    role: { type: String, enum: ROLES, default: "participant" },
    phone: { type: String, default: null },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { collection: "user", versionKey: false, autoIndex: false },
);
// Better Auth creates the unique email index; we add query support for admin lists.
userSchema.index({ role: 1, createdAt: -1 });

export const UserModel = defineModel<UserDoc>("User", userSchema);
