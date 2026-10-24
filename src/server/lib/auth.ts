import type { Context, MiddlewareHandler, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { HttpError, nowIso, unauthorized, forbidden, type Env } from "./util";

const SESSION_COOKIE = "cth_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours
const PBKDF2_ITERATIONS = 210_000;

export interface AdminUser {
  id: number;
  email: string;
  role: string;
}

interface SessionRow {
  id: number;
  admin_id: number;
  expires_at: string;
  revoked_at: string | null;
  email: string;
  role: string;
  is_active: number;
}

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

async function pbkdf2Hex(password: string, saltHex: string, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(saltHex), iterations, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const derived = await pbkdf2Hex(password, salt, PBKDF2_ITERATIONS);
  return { hash: derived, salt, iterations: PBKDF2_ITERATIONS };
}

export async function verifyPassword(password: string, hash: string, salt: string, iterations: number): Promise<boolean> {
  try {
    const a = await pbkdf2Hex(password, salt, iterations);
    if (a.length !== hash.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ hash.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

function newSessionToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(digest);
}

/** Truncate & pin client IPs (Cloudflare provides the connecting IP). */
export function clientIp(c: Context): string {
  const raw = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
  return raw.split(",")[0].trim().slice(0, 45);
}

export async function createSession(db: D1Database, admin: AdminUser, c: Context): Promise<void> {
  const token = newSessionToken();
  const tokenHash = await sha256Hex(token);
  const expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db
    .prepare(
      `INSERT INTO sessions (token_hash, admin_id, created_at, expires_at, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(tokenHash, admin.id, nowIso(), expires, clientIp(c), (c.req.header("user-agent") || "").slice(0, 200))
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(db: D1Database, c: Context): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await db
      .prepare(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`)
      .bind(nowIso(), await sha256Hex(token))
      .run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function getSessionAdmin(db: D1Database, c: Context): Promise<AdminUser | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const row = (await db
    .prepare(
      `SELECT s.id, s.admin_id, s.expires_at, s.revoked_at, a.email, a.role, a.is_active
       FROM sessions s JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = ?`,
    )
    .bind(await sha256Hex(token))
    .first()) as SessionRow | null;
  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.is_active !== 1) return null;
  if (Date.parse(row.expires_at) < Date.now()) return null;
  return { id: row.admin_id, email: row.email, role: row.role };
}

/** Guard middleware: every route after it requires a signed-in admin. */
export const requireAdmin: MiddlewareHandler<{ Bindings: Env; Variables: { admin: AdminUser } }> = async (c, next) => {
  const admin = await getSessionAdmin(c.env.DB, c);
  if (!admin) throw unauthorized();
  c.set("admin", admin);
  await next();
};

/**
 * CSRF protection for cookie-authenticated mutations: require a same-origin
 * Origin header on unsafe methods. Browsers always send Origin on POST from
 * JS; curl/tests without Origin are rejected too (defence in depth).
 */
export async function requireSameOrigin(c: Context, next: Next): Promise<void> {
  const method = c.req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    await next();
    return;
  }
  const origin = c.req.header("origin");
  if (!origin) throw forbidden("Missing origin.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Invalid origin.");
  }
  const host = (c.req.header("host") || "").toLowerCase();
  const appOrigin = c.env?.APP_ORIGIN ? new URL(c.env.APP_ORIGIN).host.toLowerCase() : null;
  if (originHost !== host && originHost !== appOrigin) throw forbidden("Cross-origin request blocked.");
  await next();
}

export async function assertSetupAllowed(env: Env): Promise<void> {
  if (!env.ADMIN_SETUP_TOKEN) {
    throw new HttpError(503, "setup_disabled", "Admin setup is disabled until ADMIN_SETUP_TOKEN is configured.");
  }
}
