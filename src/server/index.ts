import { Hono } from "hono";
import type { Env } from "./lib/util";
import { HttpError } from "./lib/util";
import { requireSameOrigin, requireAdmin } from "./lib/auth";
import { publicRoutes } from "./routes/public";
import { adminAuthRoutes } from "./routes/auth";
import { adminDataRoutes } from "./routes/adminData";
import { growthRoutes } from "./routes/growth";
import { reportRoutes } from "./routes/reports";

type Vars = { admin: { id: number; email: string; role: string } };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

/* ------------------------------- security headers ------------------------------ */

app.use("*", async (c, next) => {
  await next();
  c.header("x-content-type-options", "nosniff");
  c.header("x-frame-options", "DENY");
  c.header("referrer-policy", "strict-origin-when-cross-origin");
  c.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
  c.header("cross-origin-opener-policy", "same-origin");
  if (c.req.path.startsWith("/api/")) c.header("cache-control", "no-store");
});

/* --------------------------------- error handling ------------------------------ */

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message, code: err.code }, err.status as 400);
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/UNIQUE constraint failed/.test(msg)) {
    return c.json({ error: "That record already exists.", code: "conflict" }, 409);
  }
  if (msg.includes("Malformed JSON")) {
    return c.json({ error: "Invalid JSON body.", code: "bad_request" }, 400);
  }
  console.error("Unhandled error:", msg, err instanceof Error ? err.stack : "");
  return c.json({ error: "Unexpected server error.", code: "server_error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found.", code: "not_found" }, 404));

/* ----------------------------------- API routes -------------------------------- */

// Public, unauthenticated.
app.route("/api/public", publicRoutes);

// Admin auth: unauthenticated by design (setup, login, logout, me).
app.route("/api/admin/auth", adminAuthRoutes);

// CSRF: cookie-authenticated mutations must come from our own origin.
app.use("/api/admin/data/*", requireSameOrigin);
app.use("/api/admin/growth/*", requireSameOrigin);
app.use("/api/admin/reports/*", requireSameOrigin);
app.use("/api/admin/auth/change-password", requireSameOrigin);

// Session guard, then each group's routes.
app.use("/api/admin/data/*", requireAdmin);
app.use("/api/admin/growth/*", requireAdmin);
app.use("/api/admin/reports/*", requireAdmin);

app.route("/api/admin/data", adminDataRoutes);
app.route("/api/admin/growth", growthRoutes);
app.route("/api/admin/reports", reportRoutes);

export default app;
