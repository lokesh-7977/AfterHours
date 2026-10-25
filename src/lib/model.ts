import mongoose, { type Model, type Schema } from "mongoose";
import { newId } from "./ids";

/** UUID v7 string primary key used by every application-owned collection. */
export const uuidPrimaryKey = { type: String, default: () => newId() } as const;

/** Reference to another document's UUID string id. */
export const ref = (model: string, required = true) => ({ type: String, ref: model, required, index: false }) as const;

/** Reuse a compiled model across hot reloads / repeated imports. */
export function defineModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export function iso(date: Date | null | undefined): string | null {
  return date ? new Date(date).toISOString() : null;
}
