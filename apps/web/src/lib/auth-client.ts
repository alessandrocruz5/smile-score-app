import { createAuthClient } from "better-auth/react";

// No baseURL: the client talks to the same origin's /api/auth.
export const authClient = createAuthClient();
