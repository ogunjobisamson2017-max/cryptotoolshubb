import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, Loading, Modal, StatusBadge, TelegramBadge, fmtDate, useToast } from "./shared";

interface Lead {
  id: number;
  referral_id: string;
  first_name: string;
  email: string;
  country: string;
  interest: string;
  contact_method: string | null;
  status: string;
  notes: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  ref_code: string | null;
  created_at: string;
  unsubscribed: number;
  telegram_clicks: number;
  confirmed_sales: number;
}

interface ListResp {
  total: number;
  page: number;
  limit: number;
  results: Lead[];
}

const STATUSES = ["all", "New", "Contacted", "Interested", "Converted", "Not Interested"];
const PAGE_SIZE = 25;

export default function LeadsPage() {
  const toast = useToast();
  const [data, setData] = useState<ListResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [editStatus, setEditStatus] = useState("New");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (p: number, s: string, st: string) => {
      setError(null);
      try {
        const qs = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
        if (s.trim()) qs.set("search", s.trim());
        if (st !== "all") qs.set("status", st);
        const r = await api.get<ListResp>(`/api/admin/data/leads?${qs}`);
        setData(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load leads.");
      }
    },
    [],
  );

  useEffect(() => {
    void load(page, search, status);
  }, [page, status, load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    void load(1, search, status);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/api/admin/data/leads/${editing.id}`, { status: editStatus, notes: editNotes });
      toast(`Lead ${editing.referral_id} updated`, "success");
      setEditing(null);
      void load(page, search, status);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      const res = await fetch(`/api/admin/reports/export/leads?${qs}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cryptotoolshubb-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Leads CSV downloaded", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <div className="toolbar">
        <form onSubmit={onSearch} className="grow" style={{ display: "flex", gap: 8 }}>
          <input
            className="grow"
            type="search"
            placeholder="Search name, email or referral ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search leads"
          />
          <button className="btn btn-secondary btn-sm" type="submit">
            Search
          </button>
        </form>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={exporting}>
          {exporting ? "Exporting…" : "⬇ Export CSV"}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {!data ? (
        <Loading label="Loading leads…" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Referral ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Country</th>
                  <th>Interest</th>
                  <th>Registered</th>
                  <th>Source / Campaign</th>
                  <th>TG click</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!data.results.length ? (
                  <tr>
                    <td colSpan={11}>
                      <EmptyState
                        title="No leads match these filters"
                        hint="Registrations from the public Get Started page will appear here."
                      />
                    </td>
                  </tr>
                ) : (
                  data.results.map((l) => (
                    <tr key={l.id}>
                      <td className="mono">{l.referral_id}</td>
                      <td className="strong">
                        {l.first_name}
                        {l.unsubscribed ? (
                          <span className="badge badge-red" style={{ marginLeft: 6 }}>
                            unsub
                          </span>
                        ) : null}
                      </td>
                      <td>{l.email}</td>
                      <td>{l.country}</td>
                      <td>{l.interest}</td>
                      <td>{fmtDate(l.created_at)}</td>
                      <td>
                        {l.source ? l.source.replace(/_/g, " ") : "—"}
                        {l.campaign ? <div className="tiny muted">{l.campaign}</div> : null}
                      </td>
                      <td>
                        <TelegramBadge count={l.telegram_clicks} />
                      </td>
                      <td>
                        <StatusBadge status={l.status} />
                      </td>
                      <td className="tiny" style={{ maxWidth: 160 }}>
                        {l.notes ? l.notes.slice(0, 60) : "—"}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setEditing(l);
                            setEditStatus(l.status);
                            setEditNotes(l.notes ?? "");
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>
              {data.total} lead{data.total === 1 ? "" : "s"} · page {data.page} of {totalPages}
            </span>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Prev
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </span>
          </div>
        </>
      )}

      {editing && (
        <Modal title={`Edit ${editing.referral_id}`} onClose={() => setEditing(null)}>
          <dl className="kv">
            <dt>Name</dt>
            <dd>{editing.first_name}</dd>
            <dt>Email</dt>
            <dd>{editing.email}</dd>
            <dt>Interest</dt>
            <dd>{editing.interest}</dd>
            <dt>Source</dt>
            <dd>{editing.source ?? "—"}</dd>
            <dt>Telegram clicks</dt>
            <dd>
              {editing.telegram_clicks} {editing.confirmed_sales > 0 ? `· ${editing.confirmed_sales} confirmed sale(s)` : ""}
            </dd>
          </dl>
          <div className="field mt-3">
            <label htmlFor="lstatus">Status</label>
            <select id="lstatus" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
              {STATUSES.filter((s) => s !== "all").map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="lnotes">Notes</label>
            <textarea id="lnotes" maxLength={2000} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
