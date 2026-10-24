import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/* --------------------------------- toasts ---------------------------------- */

interface Toast {
  id: number;
  text: string;
  kind: "success" | "error" | "info";
}

const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/* ---------------------------------- modal ----------------------------------- */

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 760 } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------- stat cards -------------------------------- */

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "green" | "blue";
}) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ""}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

/* ------------------------------- status badges ------------------------------ */

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "badge";
  if (["confirmed", "paid", "converted", "published", "connected", "interested", "contacted"].includes(s)) cls += " badge-green";
  else if (["new", "draft", "scheduled", "pending"].includes(s)) cls += " badge-blue";
  else if (["not interested", "rejected", "failed", "not_connected"].includes(s)) cls += " badge-red";
  else if (["process"].includes(s)) cls += " badge-amber";
  return <span className={cls}>{status.replace("_", " ")}</span>;
}

export function TelegramBadge({ count }: { count: number }) {
  if (!count) return <span className="badge">No</span>;
  return <span className="badge badge-blue">{count}×</span>;
}

/* ------------------------------ formatting helpers -------------------------- */

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {hint}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading">
      <div className="spinner" />
      {label}
    </div>
  );
}
