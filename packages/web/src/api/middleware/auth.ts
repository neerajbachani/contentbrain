import { createMiddleware } from "hono/factory";
import { auth } from "../auth";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  [key: string]: any;
};

export type AuthSession = {
  id: string;
  userId: string;
  [key: string]: any;
};

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser | null;
    session: AuthSession | null;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", (session?.user as AuthUser) ?? null);
  c.set("session", (session?.session as AuthSession) ?? null);
  return next();
});

export const requireAuth = createMiddleware(async (c, next) => {
  if (!c.get("user")) return c.json({ message: "Unauthorized" }, 401);
  return next();
});
