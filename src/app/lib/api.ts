/** Client-side API helpers: typed fetch with error propagation. */

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    credentials: "same-origin",
    ...init,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? ((data as { error: string }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, data && typeof data === "object" && "code" in data ? String((data as { code: unknown }).code) : undefined);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/* ------------------------- attribution (UTM + ref) -------------------------- */

export interface Attribution {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  refCode: string | null;
  content: string | null;
}

const ATTR_KEY = "cth_attr";

/** Read UTM/ref params from the URL and remember them for this browser session. */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return emptyAttr();
  const p = new URLSearchParams(window.location.search);
  const attr: Attribution = {
    source: p.get("utm_source"),
    medium: p.get("utm_medium"),
    campaign: p.get("utm_campaign"),
    refCode: p.get("ref") || p.get("ref_code"),
    content: p.get("utm_content"),
  };
  const hasAny = attr.source || attr.medium || attr.campaign || attr.refCode;
  try {
    if (hasAny) {
      sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr));
    } else {
      const stored = sessionStorage.getItem(ATTR_KEY);
      if (stored) return { ...emptyAttr(), ...JSON.parse(stored) };
    }
  } catch {
    /* storage unavailable — attribution stays page-local */
  }
  return attr;
}

export function storedAttribution(): Attribution {
  if (typeof window === "undefined") return emptyAttr();
  const fromUrl = captureAttribution();
  if (fromUrl.source || fromUrl.campaign) return fromUrl;
  try {
    const stored = sessionStorage.getItem(ATTR_KEY);
    if (stored) return { ...fromUrl, ...JSON.parse(stored) };
  } catch {
    /* ignore */
  }
  return fromUrl;
}

function emptyAttr(): Attribution {
  return { source: null, medium: null, campaign: null, refCode: null, content: null };
}

/** Fire-and-forget first-party page view beacon (counts captured events only). */
export function trackView(path: string): void {
  const attr = storedAttribution();
  const payload = {
    path,
    source: attr.source,
    medium: attr.medium,
    campaign: attr.campaign,
    refCode: attr.refCode,
  };
  try {
    void fetch("/api/public/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* tracking must never break the page */
  }
}

/** Build the prefilled Telegram deep link to the supervisor. */
export function telegramLink(username: string, referralId: string, referralName: string, brand: string): string {
  const message =
    `Hello, I'm interested in your crypto services. I found you through ${brand}. ` +
    `Referral name: ${referralName}. Referral ID: ${referralId}.`;
  return `https://t.me/${username}?text=${encodeURIComponent(message)}`;
}

/**
 * Record a Telegram button click, then open Telegram.
 * A click is never treated as a sent message or a sale.
 */
export async function trackTelegramClick(referralId: string): Promise<void> {
  const attr = storedAttribution();
  try {
    await fetch("/api/public/telegram-click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        referralId,
        source: attr.source,
        medium: attr.medium,
        campaign: attr.campaign,
        landingPage: typeof window !== "undefined" ? window.location.pathname : null,
      }),
      keepalive: true,
    });
  } catch {
    /* never block the redirect on tracking failure */
  }
}
