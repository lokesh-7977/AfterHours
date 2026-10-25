import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { Auth } from "./auth";

/** Browser-side Better Auth client. Talks to /api/auth on the current origin. */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
});
