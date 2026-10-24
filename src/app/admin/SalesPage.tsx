import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { EmptyState, Loading, Modal, StatusBadge, fmtDay, fmtMoney, useToast } from "./shared";

interface Sale {
  id: number;
  referral_id: string;
  lead_id: number | null;
  customer_label: string;
  product_name: string;
  sale_date: string;
  sale_amount_usd: number;
  commission_usd: number;
  payment_status: string;
  confirmation_source: string | null;
  notes: string | null;
  confirmed_at: string | null;
  created_at: string;
}

interface SalesResp {
  total: number;
  results: Sale[];
  confirmedTotals: { revenue: number; commission: number };
}

const PAYMENT_STATUSES = ["Pending", "Confirmed", "Paid", "Rejected"];
const PAGE_SIZE = 25;

export default function SalesPage() {
  const toast = useToast();
  const [data, setData] = useState<SalesResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payFilter, setPayFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [referralId, setReferralId] = useState("");
  const [customer, setCustomer] = useState("");
  const [product, setProduct] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [commission, setCommission] = useState("");
  const [payStatus, setPayStatus] = useState("Pending");
  const [confirmSource, setConfirmSource] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (st: string, s: string) => {
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (st !== "all") qs.set("status", st);
      if (s.trim()) qs.set("search", s.trim());
      const r = await api.get<SalesResp>(`/api/admin/data/sales?${qs}`);
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sales.");
    }
  }, []);

  useEffect(() => {
    void load(payFilter, search);
  }, [payFilter, load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(payFilter, search);
  }

  async function createSale(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!confirmSource.trim() && (payStatus === "Confirmed" || payStatus === "Paid")) {
      setFormError("Confirmed/Paid sales need a confirmation source — how the sale was verified (e.g. 'supervisor Telegram confirmation 2026-10-22').");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/admin/data/sales", {
        referralId,
        customerLabel: customer,
        productName: product,
        saleDate,
        saleAmountUsd: Number(amount) || 0,
        commissionUsd: Number(commission) || 0,
        paymentStatus: payStatus,
        confirmationSource: confirmSource.trim() || null,
        notes: notes.trim() || null,
      });
      toast("Sale recorded", "success");
      setShowForm(false);
      setReferralId("");
      setCustomer("");
      setProduct("");
      setAmount("");
      setCommission("");
      setConfirmSource("");
      setNotes("");
      void load(payFilter, search);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save sale.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(sale: Sale, next: string) {
    const needsSource = next === "Confirmed" || next === "Paid";
    let source = sale.confirmation_source ?? "";
    if (needsSource && !source) {
      source = window.prompt(
        "How was this sale verified? (confirmation source — required before it counts as confirmed)",
        "",
      )?.trim() ?? "";
      if (!source) {
        toast("Confirmation source required — status not changed.", "error");
        return;
      }
    }
    try {
      await api.patch(`/api/admin/data/sales/${sale.id}`, { paymentStatus: next, confirmationSource: source || undefined });
      toast(`Sale marked ${next}`, "success");
      void load(payFilter, search);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed.", "error");
    }
  }

  async function removeSale(sale: Sale) {
    if (!window.confirm(`Delete the sale record for ${sale.referral_id}? This is audited and cannot be undone.`)) return;
    try {
      await api.del(`/api/admin/data/sales/${sale.id}`);
      toast("Sale deleted", "success");
      void load(payFilter, search);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed.", "error");
    }
  }

  async function exportCsv(kind: "sales" | "commissions") {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/reports/export/${kind}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cryptotoolshubb-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(`${kind} CSV downloaded`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Verified revenue</div>
          <div className="value green">{fmtMoney(data?.confirmedTotals.revenue ?? 0)}</div>
          <div className="sub">Confirmed + Paid only</div>
        </div>
        <div className="stat-card">
          <div className="label">Verified commission</div>
          <div className="value green">{fmtMoney(data?.confirmedTotals.commission ?? 0)}</div>
          <div className="sub">Never inferred from clicks</div>
        </div>
        <div className="stat-card">
          <div className="label">Sale records</div>
          <div className="value">{data?.total ?? 0}</div>
          <div className="sub">All statuses</div>
        </div>
        <div className="stat-card">
          <div className="label">Pending verification</div>
          <div className="value blue">{(data?.results ?? []).filter((s) => s.payment_status === "Pending").length}</div>
          <div className="sub">In current view</div>
        </div>
      </div>

      <div className="toolbar">
        <form onSubmit={onSearch} style={{ display: "flex", gap: 8 }} className="grow">
          <input
            className="grow"
            type="search"
            placeholder="Search referral ID, customer or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search sales"
          />
          <button className="btn btn-secondary btn-sm" type="submit">
            Search
          </button>
        </form>
        <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)} aria-label="Filter sales by status">
          <option value="all">All statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          + Record sale
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => exportCsv("sales")} disabled={exporting}>
          ⬇ Sales CSV
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => exportCsv("commissions")} disabled={exporting}>
          ⬇ Commissions CSV
        </button>
      </div>

      <div className="notice info tiny" style={{ marginBottom: 16 }}>
        A Telegram click or registration never creates a sale. Record a sale only after it has been verified, and only
        mark it Confirmed/Paid with a stated confirmation source.
      </div>

      {error && <div className="form-error">{error}</div>}
      {!data ? (
        <Loading label="Loading sales…" />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Referral ID</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Sale date</th>
                <th>Amount</th>
                <th>Commission</th>
                <th>Payment status</th>
                <th>Confirmation source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!data.results.length ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No sales recorded"
                      hint="Use “Record sale” after you have verified a purchase with your supervisor."
                    />
                  </td>
                </tr>
              ) : (
                data.results.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.referral_id}</td>
                    <td className="strong">{s.customer_label}</td>
                    <td>{s.product_name}</td>
                    <td>{fmtDay(s.sale_date)}</td>
                    <td>{fmtMoney(s.sale_amount_usd)}</td>
                    <td className="strong">{fmtMoney(s.commission_usd)}</td>
                    <td>
                      <StatusBadge status={s.payment_status} />
                    </td>
                    <td className="tiny" style={{ maxWidth: 200 }}>
                      {s.confirmation_source ?? "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {PAYMENT_STATUSES.filter((p) => p !== s.payment_status).map((p) => (
                          <button key={p} className="btn btn-ghost btn-sm" onClick={() => setStatus(s, p)} title={`Mark as ${p}`}>
                            {p}
                          </button>
                        ))}
                        <button className="btn btn-danger btn-sm" onClick={() => removeSale(s)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title="Record a verified sale" onClose={() => setShowForm(false)}>
          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}
          <form onSubmit={createSale}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="sref">Referral ID *</label>
                <input
                  id="sref"
                  type="text"
                  placeholder="CTH-000001"
                  value={referralId}
                  onChange={(e) => setReferralId(e.target.value)}
                  required
                />
                <div className="hint">Must match a registered lead.</div>
              </div>
              <div className="field">
                <label htmlFor="scust">Customer / lead *</label>
                <input id="scust" type="text" value={customer} onChange={(e) => setCustomer(e.target.value)} required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="sprod">Product purchased *</label>
              <input
                id="sprod"
                type="text"
                placeholder="e.g. Trading bot subscription (plan name — confirm with supervisor)"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                required
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="sdate">Sale date *</label>
                <input id="sdate" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="sstatus">Payment status *</label>
                <select id="sstatus" value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
                  {PAYMENT_STATUSES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="samount">Sale amount (USD) *</label>
                <input
                  id="samount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="scomm">Commission earned (USD) *</label>
                <input
                  id="scomm"
                  type="number"
                  min="0"
                  step="0.01"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  required
                />
                <div className="hint">Enter 0 until the commission is confirmed.</div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="ssource">
                Confirmation source {(payStatus === "Confirmed" || payStatus === "Paid") && <span className="req">*</span>}
              </label>
              <input
                id="ssource"
                type="text"
                placeholder="e.g. Supervisor Telegram confirmation, payment receipt ID"
                value={confirmSource}
                onChange={(e) => setConfirmSource(e.target.value)}
              />
              <div className="hint">Required before a sale can count as Confirmed or Paid.</div>
            </div>
            <div className="field">
              <label htmlFor="snotes">Notes (optional)</label>
              <textarea id="snotes" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? "Saving…" : "Record sale"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
