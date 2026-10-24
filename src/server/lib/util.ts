export const CONSENT_VERSION = "2026-10-v1";

export const LEAD_STATUSES = ["New", "Contacted", "Interested", "Converted", "Not Interested"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const PAYMENT_STATUSES = ["Pending", "Confirmed", "Paid", "Rejected"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CONTENT_STATUSES = ["Draft", "Scheduled", "Published", "Failed"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const PLATFORMS = ["Instagram", "X", "Facebook", "Telegram", "LinkedIn", "Blog", "Email"] as const;

export const INTERESTS = ["Trading Bots", "Crypto Research", "Both"] as const;
export const CONTACT_METHODS = ["Email", "Telegram", "No preference"] as const;

export const CONFIRMED_SALE_STATUSES: PaymentStatus[] = ["Confirmed", "Paid"];

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayUtc(): string {
  return nowIso().slice(0, 10);
}

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, "bad_request", message);
}

export function unauthorized(message = "Sign in required."): HttpError {
  return new HttpError(401, "unauthorized", message);
}

export function forbidden(message = "Not allowed."): HttpError {
  return new HttpError(403, "forbidden", message);
}

export function notFound(message = "Not found."): HttpError {
  return new HttpError(404, "not_found", message);
}

export function conflict(message: string): HttpError {
  return new HttpError(409, "conflict", message);
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_SETUP_TOKEN?: string;
  APP_ORIGIN?: string;
  APP_ENV?: string;
}
