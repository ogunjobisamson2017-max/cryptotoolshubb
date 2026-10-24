import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { EmptyState, Loading, fmtDate, useToast } from "./shared";

interface AuditRow {
  id: number;
  admin_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: string | null;
  created_at: string;
}

interface TrafficDay {
  day: string;
  views: number;
  leads: number;
  clicks: number;
}

const EXPORTS: { key: string; label: string; desc: string }[] = [
  { key: "leads", label: "Leads", desc: "Every registration with referral ID, attribution, status and consent flag." },
  { key: "referral-activity", label: "Referral activity", desc: "Telegram click events with timestamps and source." },
  { key: "sales", label: "Confirmed sales", desc: "Verified sales with amounts, statuses and confirmation sources." },
  { key: "commissions", label: "Commission records", desc: "Commission earned on Confirmed/Paid sales only." },
  { key: "campaigns", label: "Campaign performance", desc: "Registrations, clicks and confirmed conversions per campaign." },
  { key: "traffic", label: "Traffic by day", desc: "Captured page views, registrations and clicks per day." },
];

export default function ReportsPage() {
  const toast = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [traffic, setTraffic] = useState<TrafficDay[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  const loadTraffic = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const csv = await fetch(`/api/admin/reports/export/traffic?${qs}`, { credentials: "same-origin" });
      if (!csv.ok) throw new Error("Failed to load traffic.");
      const text = await csv.text();
      setTraffic(parseCsv(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load traffic.");
      setTraffic([]);
    }
  }, [from, to]);

  useEffect(() => {
    void loadTraffic();
  }, [loadTraffic]);

  const loadAudit = useCallback(async () => {
    try {
      const r = await api.get<{ results: AuditRow[] }>("/api/admin/reports/audit?limit=40");
      setAudit(r.results);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load audit log.", "error");
      setAudit([]);
    }
  }, [toast]);

  async function download(key: string) {
    setExporting(key);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`/api/admin/reports/export/${key}?${qs}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cryptotoolshubb-${key}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(`${key} CSV downloaded`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed.", "error");
    } finally {
      setExporting(null);
    }
  }

  const totals = traffic
    ? traffic.reduce(
        (acc, t) => ({
          views: acc.views + (t.views || 0),
          leads: acc.leads + (t.leads || 0),
          clicks: acc.clicks + (t.clicks || 0),
        }),
        { views: 0, leads: 0, clicks: 0 },
      )
    : null;

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: "1.25rem" }}>Reports &amp; CSV exports</h2>
        <p className="small muted mb-0">
          All figures count events actually captured by this system. Exports respect the date range below (leave empty
          for all time). Files download straight from the server as CSV.
        </p>
      </div>

      <div className="toolbar">
        <label className="tiny muted" htmlFor="rfrom">
          From
        </label>
        <input id="rfrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label className="tiny muted" htmlFor="rto">
          To
        </label>
        <input id="rto" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn btn-secondary btn-sm" onClick={() => void loadTraffic()}>
          Apply
        </button>
        {(from || to) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="grid grid-3" style={{ marginBottom: 26 }}>
        {EXPORTS.map((x) => (
          <div className="card" key={x.key}>
            <h3 style={{ fontSize: "1rem" }}>{x.label}</h3>
            <p className="tiny">{x.desc}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => download(x.key)} disabled={exporting === x.key}>
              {exporting === x.key ? "Preparing…" : "⬇ Download CSV"}
            </button>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <h3 style={{ margin: 0 }}>Traffic summary (captured events)</h3>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setShowAudit((s) => !s);
            if (!audit && !showAudit) void loadAudit();
          }}
        >
          {showAudit ? "Hide" : "Show"} audit log
        </button>
      </div>

      {!traffic ? (
        <Loading label="Loading traffic…" />
      ) : !traffic.length ? (
        <EmptyState title="No events captured in this range" hint="Page views and registrations will appear as visitors arrive." />
      ) : (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="stat-card">
              <div className="label">Page views (captured)</div>
              <div className="value blue">{totals?.views ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="label">Registrations</div>
              <div className="value green">{totals?.leads ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="label">Telegram clicks</div>
              <div className="value">{totals?.clicks ?? 0}</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Day (UTC)</th>
                  <th>Page views</th>
                  <th>Registrations</th>
                  <th>Telegram clicks</th>
                </tr>
              </thead>
              <tbody>
                {traffic.slice(0, 60).map((t) => (
                  <tr key={t.day}>
                    <td className="strong">{t.day}</td>
                    <td>{t.views}</td>
                    <td>{t.leads}</td>
                    <td>{t.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted mt-2">
            These are first-party events recorded on this server only — external referrers, direct visits without the
            tracking beacon, and platform-native analytics are not included, and no numbers are estimated.
          </p>
        </>
      )}

      {showAudit && (
        <div className="mt-4">
          <h3>Audit log (latest 40)</h3>
          {!audit ? (
            <Loading label="Loading audit log…" />
          ) : !audit.length ? (
            <EmptyState title="No audit entries yet" />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td>{fmtDate(a.created_at)}</td>
                      <td>{a.admin_email ?? "system"}</td>
                      <td className="mono">{a.action}</td>
                      <td className="tiny">
                        {a.detail}
                        {a.entity && a.entity_id ? ` (${a.entity}#${a.entity_id})` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Minimal CSV parser for the traffic summary (server-generated, RFC-4180). */
function parseCsv(text: string): TrafficDay[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (rows.length < 2) return [];
  const header = rows[0];
  const idx = (name: string) => header.indexOf(name);
  return rows.slice(1).filter((r) => r.length > 1).map((r) => ({
    day: r[idx("Day (UTC)")] ?? "",
    views: Number(r[idx("Page views (captured)")] ?? 0) || 0,
    leads: Number(r[idx("Registrations")] ?? 0) || 0,
    clicks: Number(r[idx("Telegram clicks")] ?? 0) || 0,
  }));
}
