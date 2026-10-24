import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { EmptyState, Loading, StatCard, StatusBadge, TelegramBadge, fmtDay, fmtMoney, fmtDate } from "./shared";

interface Overview {
  range: { from: string | null; to: string | null };
  totals: {
    totalLeads: number;
    leadsToday: number;
    leadsInRange: number;
    telegramClicks: number;
    telegramClicksToday: number;
    confirmedCustomers: number;
    confirmedSales: number;
    totalConfirmedCommission: number;
    pendingSales: number;
    conversionRate: number;
    pageViews: number;
    pageViewsInRange: number;
    contentInQueue: number;
  };
  trafficSources: { source: string; leads: number; telegramClicks: number }[];
  statusBreakdown: { status: string; n: number }[];
  recentLeads: {
    referral_id: string;
    first_name: string;
    interest: string;
    status: string;
    source: string | null;
    created_at: string;
  }[];
  recentSales: {
    referral_id: string;
    customer_label: string;
    product_name: string;
    sale_amount_usd: number;
    commission_usd: number;
    payment_status: string;
    sale_date: string;
  }[];
  contentInQueue?: number;
  disclaimer: string;
}

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load(f?: string, t?: string) {
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (f) qs.set("from", f);
      if (t) qs.set("to", t);
      const r = await api.get<Overview>(`/api/admin/data/overview${qs.toString() ? `?${qs}` : ""}`);
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load overview.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (error)
    return (
      <div>
        <div className="form-error">{error}</div>
        <button className="btn btn-secondary btn-sm" onClick={() => load()}>
          Retry
        </button>
      </div>
    );
  if (!data) return <Loading label="Loading overview…" />;

  const t = data.totals;
  const maxSource = Math.max(1, ...data.trafficSources.map((s) => s.leads));

  return (
    <div>
      <div className="toolbar">
        <label className="tiny muted" htmlFor="ov-from">
          From
        </label>
        <input id="ov-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label className="tiny muted" htmlFor="ov-to">
          To
        </label>
        <input id="ov-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn btn-secondary btn-sm" onClick={() => load(from, to)}>
          Apply range
        </button>
        {(from || to) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setFrom("");
              setTo("");
              load();
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="stat-grid">
        <StatCard label="Total leads" value={t.totalLeads} sub={`${t.leadsToday} registered today`} tone="blue" />
        <StatCard label="Telegram clicks" value={t.telegramClicks} sub={`${t.telegramClicksToday} today · clicks ≠ sales`} tone="blue" />
        <StatCard label="Confirmed customers" value={t.confirmedCustomers} sub={`${t.pendingSales} sale(s) pending verification`} tone="green" />
        <StatCard label="Confirmed sales" value={t.confirmedSales} sub="Verified records only" tone="green" />
        <StatCard label="Confirmed commission" value={fmtMoney(t.totalConfirmedCommission)} sub="Confirmed + Paid statuses" tone="green" />
        <StatCard label="Conversion rate" value={`${t.conversionRate}%`} sub="Confirmed customers ÷ total leads" tone="green" />
        <StatCard label="Page views (captured)" value={t.pageViews} sub="First-party events only" />
        <StatCard label="Content queue" value={t.contentInQueue} sub="Drafts + scheduled posts" />
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <h3>Traffic sources</h3>
          {!data.trafficSources.length ? (
            <EmptyState title="No attributed traffic yet" hint="Sources appear once leads register with UTM parameters." />
          ) : (
            data.trafficSources.map((s) => (
              <div className="bar-row" key={s.source}>
                <span className="muted" style={{ textTransform: "capitalize" }}>
                  {s.source.replace(/_/g, " ")}
                </span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(s.leads / maxSource) * 100}%` }} />
                </span>
                <span className="mono" style={{ textAlign: "right" }}>
                  {s.leads}
                </span>
              </div>
            ))
          )}
          <p className="tiny muted mt-2 mb-0">
            Counts are captured events from this system only — organic traffic beyond tracked visits is not measured.
          </p>
        </div>

        <div className="card">
          <h3>Lead status breakdown</h3>
          {!data.statusBreakdown.length ? (
            <EmptyState title="No leads yet" />
          ) : (
            <div className="toolbar" style={{ marginBottom: 0 }}>
              {data.statusBreakdown.map((s) => (
                <StatusBadge key={s.status} status={`${s.status} (${s.n})`} />
              ))}
            </div>
          )}
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0" }} />
          <div className="notice info tiny">
            {data.disclaimer}
          </div>
        </div>
      </div>

      <div className="grid grid-2 mt-3" style={{ alignItems: "start" }}>
        <div>
          <div className="toolbar">
            <h3 style={{ margin: 0 }}>Recent leads</h3>
            <span style={{ flex: 1 }} />
            <Link to="/admin/leads" className="btn btn-ghost btn-sm">
              All leads →
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Referral</th>
                  <th>Name</th>
                  <th>Interest</th>
                  <th>Status</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {!data.recentLeads.length ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState title="No leads yet" hint="Registrations from the Get Started page appear here." />
                    </td>
                  </tr>
                ) : (
                  data.recentLeads.map((l) => (
                    <tr key={l.referral_id}>
                      <td className="mono">{l.referral_id}</td>
                      <td className="strong">{l.first_name}</td>
                      <td>{l.interest}</td>
                      <td>
                        <StatusBadge status={l.status} />
                      </td>
                      <td>{fmtDate(l.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="toolbar">
            <h3 style={{ margin: 0 }}>Recent sales</h3>
            <span style={{ flex: 1 }} />
            <Link to="/admin/sales" className="btn btn-ghost btn-sm">
              All sales →
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Referral</th>
                  <th>Customer</th>
                  <th>Commission</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {!data.recentSales.length ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState title="No sales recorded" hint="Record a sale after it's verified — clicks never create sales." />
                    </td>
                  </tr>
                ) : (
                  data.recentSales.map((s, i) => (
                    <tr key={`${s.referral_id}-${i}`}>
                      <td className="mono">{s.referral_id}</td>
                      <td className="strong">{s.customer_label}</td>
                      <td>{fmtMoney(s.commission_usd)}</td>
                      <td>
                        <StatusBadge status={s.payment_status} />
                      </td>
                      <td>{fmtDay(s.sale_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="tiny muted mt-2">
            <TelegramBadge count={t.telegramClicks} /> Telegram clicks recorded in total — clicks are referral activity,
            never sales.
          </div>
        </div>
      </div>
    </div>
  );
}
