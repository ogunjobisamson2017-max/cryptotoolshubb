import { Hono } from "hono";
import type { Env } from "../lib/util";
import { badRequest, conflict, forbidden, HttpError, nowIso, unauthorized } from "../lib/util";
import { cleanEmail, cleanString } from "../lib/validate";
import {
  assertSetupAllowed,
  createSession,
  destroySession,
  getSessionAdmin,
  hashPassword,
  verifyPassword,
} from "../lib/auth";
import { audit } from "./public";

export const adminAuthRoutes = new Hono<{ Bindings: Env }>();

// Simple in-memory per-isolate rate limit for login attempts.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > max) {
    throw new HttpError(429, "rate_limited", "Too many attempts. Please wait a few minutes and try again.");
  }
}

/** Whether the first admin still needs to be created. */
adminAuthRoutes.get("/setup-status", async (c) => {
  const row = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM admins`).first<{ n: number }>();
  return c.json({ needsSetup: (row?.n ?? 0) === 0, setupTokenRequired: Boolean(envSetupToken(c.env)) });
});

function envSetupToken(env: Env): string | undefined {
  return env.ADMIN_SETUP_TOKEN;
}

/** Create the first administrator account (one-time, requires setup token). */
adminAuthRoutes.post("/setup", async (c) => {
  await assertSetupAllowed(c.env);
  const existing = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM admins`).first<{ n: number }>();
  if ((existing?.n ?? 0) > 0) throw conflict("Setup already completed.");

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body.");
  }
  const token = cleanString(body.setupToken, "Setup token", { min: 8, max: 200 });
  if (token !== envSetupToken(c.env)) {
    await audit(c.env.DB, "admin.setup.failed", null, null, "Invalid setup token");
    throw forbidden("Setup token is invalid.");
  }
  const email = cleanEmail(body.email);
  const password = cleanString(body.password, "Password", { min: 12, max: 200 });
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw badRequest("Password must be at least 12 characters and include a letter and a number.");
  }

  const { hash, salt, iterations } = await hashPassword(password);
  const ts = nowIso();
  const admin = await c.env.DB.prepare(
    `INSERT INTO admins (email, password_hash, salt, iterations, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'owner', 1, ?, ?) RETURNING id`,
  )
    .bind(email, hash, salt, iterations, ts, ts)
    .first<{ id: number }>();
  if (!admin) throw conflict("Admin account could not be created.");

  await createSession(c.env.DB, { id: admin.id, email, role: "owner" }, c);
  await audit(c.env.DB, "admin.setup", "admin", String(admin.id), "First admin created", admin.id, email);
  return c.json({ ok: true, admin: { id: admin.id, email, role: "owner" } }, 201);
});

/** Sign in. */
adminAuthRoutes.post("/login", async (c) => {
  const ip = (c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 45);
  rateLimit(`login:${ip}`, 10, 10 * 60 * 1000);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body.");
  }
  const email = cleanEmail(body.email);
  const password = cleanString(body.password, "Password", { min: 1, max: 200 });

  const admin = (await c.env.DB.prepare(
    `SELECT id, email, password_hash, salt, iterations, role, is_active FROM admins WHERE email = ?`,
  )
    .bind(email)
    .first()) as
    | { id: number; email: string; password_hash: string; salt: string; iterations: number; role: string; is_active: number }
    | null;

  const ok = admin
    ? admin.is_active === 1 && (await verifyPassword(password, admin.password_hash, admin.salt, admin.iterations))
    : await verifyPassword(password, "00", "00", 1000); // constant-ish work when account is absent

  if (!admin || !ok) {
    await audit(c.env.DB, "admin.login.failed", null, null, `Failed login for ${email.slice(0, 3)}***@…`);
    throw unauthorized("Incorrect email or password.");
  }

  await c.env.DB.prepare(`UPDATE admins SET last_login_at = ? WHERE id = ?`).bind(nowIso(), admin.id).run();
  await createSession(c.env.DB, { id: admin.id, email: admin.email, role: admin.role }, c);
  await audit(c.env.DB, "admin.login", "admin", String(admin.id), "Signed in", admin.id, admin.email);
  return c.json({ ok: true, admin: { id: admin.id, email: admin.email, role: admin.role } });
});

/** Sign out. */
adminAuthRoutes.post("/logout", async (c) => {
  const admin = await getSessionAdmin(c.env.DB, c);
  await destroySession(c.env.DB, c);
  if (admin) await audit(c.env.DB, "admin.logout", "admin", String(admin.id), "Signed out", admin.id, admin.email);
  return c.json({ ok: true });
});

/** Current session. */
adminAuthRoutes.get("/me", async (c) => {
  const admin = await getSessionAdmin(c.env.DB, c);
  if (!admin) throw unauthorized();
  return c.json({ admin });
});

/** Change own password (revokes other sessions). */
adminAuthRoutes.post("/change-password", async (c) => {
  const admin = await getSessionAdmin(c.env.DB, c);
  if (!admin) throw unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body.");
  }
  const current = cleanString(body.currentPassword, "Current password", { min: 1, max: 200 });
  const next = cleanString(body.newPassword, "New password", { min: 12, max: 200 });
  if (!/[a-zA-Z]/.test(next) || !/\d/.test(next)) {
    throw badRequest("New password must be at least 12 characters and include a letter and a number.");
  }
  const row = (await c.env.DB.prepare(
    `SELECT password_hash, salt, iterations FROM admins WHERE id = ?`,
  )
    .bind(admin.id)
    .first()) as { password_hash: string; salt: string; iterations: number } | null;
  if (!row) throw unauthorized();
  if (!(await verifyPassword(current, row.password_hash, row.salt, row.iterations))) {
    await audit(c.env.DB, "admin.password.failed", "admin", String(admin.id), "Wrong current password", admin.id, admin.email);
    throw forbidden("Current password is incorrect.");
  }
  const { hash, salt, iterations } = await hashPassword(next);
  await c.env.DB.prepare(
    `UPDATE admins SET password_hash = ?, salt = ?, iterations = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(hash, salt, iterations, nowIso(), admin.id)
    .run();
  await c.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE admin_id = ? AND revoked_at IS NULL`)
    .bind(nowIso(), admin.id)
    .run();
  await createSession(c.env.DB, admin, c); // keep the current device signed in
  await audit(c.env.DB, "admin.password.changed", "admin", String(admin.id), "Password changed", admin.id, admin.email);
  return c.json({ ok: true, message: "Password updated. Other sessions were signed out." });
});
