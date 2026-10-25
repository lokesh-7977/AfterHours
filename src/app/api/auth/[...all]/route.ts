import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";

/** Better Auth native endpoints (sign-in, sign-up, verification, reset, sessions). */
async function handler(req: Request): Promise<Response> {
  await connectDB();
  return getAuth().handler(req);
}

export const GET = handler;
export const POST = handler;
