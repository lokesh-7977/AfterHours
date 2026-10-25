import "server-only";
import type { Model } from "mongoose";

/** `{ value: count }` for `field` across documents matching `match`, computed in MongoDB. */
export async function countBy<K extends string | number = string>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any model; only `aggregate` is used
  model: Model<any>,
  field: string,
  match: Record<string, unknown> = {},
): Promise<Partial<Record<K, number>>> {
  const rows = await model.aggregate<{ _id: K; n: number }>([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n])) as Partial<Record<K, number>>;
}

export function sumCounts(counts: Partial<Record<string, number>>): number {
  return Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0);
}
