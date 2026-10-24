import { badRequest } from "./util";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function cleanString(value: unknown, field: string, opts: { min?: number; max: number }): string {
  if (typeof value !== "string") throw badRequest(`${field} is required.`);
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < (opts.min ?? 1)) throw badRequest(`${field} is required.`);
  if (trimmed.length > opts.max) throw badRequest(`${field} must be ${opts.max} characters or fewer.`);
  return trimmed;
}

export function optionalString(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw badRequest(`${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`${field} must be ${max} characters or fewer.`);
  return trimmed.length ? trimmed : null;
}

export function cleanEmail(value: unknown): string {
  const raw = cleanString(value, "Email", { max: 254 });
  const email = raw.toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw badRequest("Please enter a valid email address.");
  return email;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw badRequest(`${field} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

export function optionalOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T | null {
  if (value === undefined || value === null || value === "") return null;
  return oneOf(value, allowed, field);
}

export function requireTrue(value: unknown, field: string): true {
  if (value !== true) throw badRequest(`${field} is required.`);
  return true;
}

export function boolParam(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

export function isoDate(value: unknown, field: string): string {
  const raw = cleanString(value, field, { max: 40 });
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) throw badRequest(`${field} must be a valid date.`);
  return new Date(parsed).toISOString();
}

export function positiveNumber(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) throw badRequest(`${field} must be a number of 0 or more.`);
  if (n > 1_000_000_000) throw badRequest(`${field} is too large.`);
  return Math.round(n * 100) / 100;
}

export function optionalIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return isoDate(value, field);
}

/** Clamp pagination params. */
export function paging(query: Record<string, string | undefined>): { limit: number; offset: number; page: number } {
  const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const limit = Math.max(1, Math.min(200, Number(query.limit) || 50));
  return { limit, offset: (page - 1) * limit, page };
}

/** Parse an optional YYYY-MM-DD or ISO date filter; returns ISO range bounds. */
export function dateRange(query: Record<string, string | undefined>): { from: string | null; to: string | null } {
  const parse = (v: string | undefined): string | null => {
    if (!v) return null;
    const t = Date.parse(v.length === 10 ? `${v}T00:00:00.000Z` : v);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  };
  const from = parse(query.from);
  let to = parse(query.to);
  // A bare date in `to` means end of that UTC day.
  if (to && query.to && query.to.length === 10) {
    to = `${query.to}T23:59:59.999Z`;
  }
  return { from, to };
}
