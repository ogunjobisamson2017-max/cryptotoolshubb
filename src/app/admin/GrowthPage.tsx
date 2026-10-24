import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { EmptyState, Loading, Modal, StatusBadge, fmtDay, useToast } from "./shared";

/* --------------------------------- types ----------------------------------- */

interface Campaign {
  id: number;
  name: string;
  utm_source: string;
  utm_medium: string | null;
  utm_campaign: string;
  utm_content: string | null;
  utm_term: string | null;
  landing_path: string;
  notes: string | null;
  is_active: number;
  created_at: string;
  referrals: number;
  telegram_clicks: number;
  confirmed_conversions: number;
}

interface Content {
  id: number;
  title: string;
  body: string;
  platform: string;
  content_type: string;
  status: string;
  hashtags: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  publish_url: string | null;
  failure_reason: string | null;
  created_at: string;
}

const PLATFORMS = ["Instagram", "X", "Facebook", "Telegram", "LinkedIn", "Blog", "Email"];
const STATUSES = ["all", "Draft", "Scheduled", "Published", "Failed"];

interface GeneratedDraft {
  title: string;
  body: string;
  platform: string;
  content_type: string;
  hashtags: string | null;
}
const TOPICS = [
  "understanding trading signals",
  "crypto wallet security basics",
  "evaluating trading bots before you subscribe",
  "market research methods",
  "why leverage increases risk",
  "spotting crypto scam patterns",
  "reading volatility without panic",
  "what on-chain data can and cannot tell you",
];

/* ------------------------------ main component ----------------------------- */

export default function GrowthPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"content" | "campaigns" | "calendar" | "connections">("content");

  const [items, setItems] = useState<Content[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadContent = useCallback(async (st: string) => {
    try {
      const qs = new URLSearchParams({ limit: "200" });
      if (st !== "all") qs.set("status", st);
      setItems((await api.get<{ results: Content[] }>(`/api/admin/growth/content?${qs}`)).results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load content.");
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      setCampaigns((await api.get<{ results: Campaign[] }>("/api/admin/growth/campaigns")).results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load campaigns.");
    }
  }, []);

  useEffect(() => {
    void loadContent(statusFilter);
  }, [statusFilter, loadContent]);
  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  return (
    <div>
      <div className="tabs" role="tablist">
        {(
          [
            ["content", "Content drafts"],
            ["calendar", "Weekly calendar"],
            ["campaigns", "Campaigns & UTM"],
            ["connections", "Platform connections"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="form-error">{error}</div>}

      {tab === "content" && (
        <ContentTab items={items} statusFilter={statusFilter} setStatusFilter={setStatusFilter} reload={() => loadContent(statusFilter)} toast={toast} />
      )}
      {tab === "calendar" && <CalendarTab items={items ?? []} reload={() => loadContent(statusFilter)} toast={toast} />}
      {tab === "campaigns" && <CampaignsTab campaigns={campaigns ?? []} reload={loadCampaigns} toast={toast} />}
      {tab === "connections" && <ConnectionsTab toast={toast} />}
    </div>
  );
}

/* ------------------------------ content tab -------------------------------- */

function ContentTab({
  items,
  statusFilter,
  setStatusFilter,
  reload,
  toast,
}: {
  items: Content[] | null;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  reload: () => void;
  toast: (t: string, k?: "success" | "error" | "info") => void;
}) {
  const [showGenerator, setShowGenerator] = useState(false);
  const [showEditor, setShowEditor] = useState<Content | "new" | null>(null);

  return (
    <div>
      <div className="notice info tiny" style={{ marginBottom: 16 }}>
        Drafts are generated from educational templates — nothing is published automatically. A post counts as
        <strong> Published</strong> only when you mark it so after actually publishing it (with the post URL), and
        <strong> Failed</strong> only with a stated reason.
      </div>

      <div className="toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter content by status">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm" onClick={() => setShowGenerator(true)}>
          ✨ Generate drafts
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => setShowEditor("new")}>
          + New draft
        </button>
      </div>

      {!items ? (
        <Loading label="Loading content…" />
      ) : !items.length ? (
        <EmptyState title="No content yet" hint="Use “Generate drafts” to create educational posts from templates." />
      ) : (
        <div className="grid grid-2">
          {items.map((c) => (
            <div className="card" key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                <div>
                  <span className="badge">{c.platform}</span>{" "}
                  <span className="badge badge-blue">{c.content_type}</span>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <h3 className="mt-2" style={{ fontSize: "1.02rem" }}>
                {c.title}
              </h3>
              <p style={{ whiteSpace: "pre-wrap", maxHeight: 130, overflow: "hidden" }}>{c.body}</p>
              {c.hashtags && <p className="tiny muted">{c.hashtags}</p>}
              <dl className="kv tiny">
                {c.scheduled_at && (
                  <>
                    <dt>Scheduled</dt>
                    <dd>{fmtDay(c.scheduled_at)}</dd>
                  </>
                )}
                {c.published_at && (
                  <>
                    <dt>Published</dt>
                    <dd>
                      {fmtDay(c.published_at)}
                      {c.publish_url ? (
                        <>
                          {" · "}
                          <a href={c.publish_url} target="_blank" rel="noopener noreferrer">
                            view post
                          </a>
                        </>
                      ) : null}
                    </dd>
                  </>
                )}
                {c.failure_reason && (
                  <>
                    <dt>Failure</dt>
                    <dd>{c.failure_reason}</dd>
                  </>
                )}
              </dl>
              <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowEditor(c)}>
                  Edit / status
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    if (!window.confirm(`Delete “${c.title}”?`)) return;
                    try {
                      await api.del(`/api/admin/growth/content/${c.id}`);
                      toast("Deleted", "success");
                      reload();
                    } catch (e) {
                      toast(e instanceof Error ? e.message : "Delete failed.", "error");
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showGenerator && (
        <GeneratorModal
          onClose={() => setShowGenerator(false)}
          onSaved={() => {
            setShowGenerator(false);
            reload();
          }}
          toast={toast}
        />
      )}
      {showEditor && (
        <EditorModal
          item={showEditor === "new" ? null : showEditor}
          onClose={() => setShowEditor(null)}
          onSaved={() => {
            setShowEditor(null);
            reload();
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

/* ---------------------------- generator modal ------------------------------ */

function GeneratorModal({
  onClose,
  onSaved,
  toast,
}: {
  onClose: () => void;
  onSaved: () => void;
  toast: (t: string, k?: "success" | "error" | "info") => void;
}) {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [customTopic, setCustomTopic] = useState("");
  const [platform, setPlatform] = useState("X");
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const chosen = customTopic.trim() || topic;
      const r = await api.post<{ generated: GeneratedDraft[] }>("/api/admin/growth/content/generate", {
        topic: chosen,
        platform,
        count,
      });
      setDrafts(r.generated);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Generation failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function saveAll() {
    setLoading(true);
    try {
      for (const d of drafts) {
        await api.post("/api/admin/growth/content", {
          title: d.title,
          body: d.body,
          platform: d.platform,
          contentType: d.content_type,
          hashtags: d.hashtags,
          status: "Draft",
        });
      }
      toast(`${drafts.length} draft(s) saved`, "success");
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Saving failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Generate educational content drafts" onClose={onClose} wide>
      <div className="notice info tiny">
        Templates only — no external AI service is called, and nothing is published. Every draft includes risk language
        and avoids performance claims. Review before publishing.
      </div>
      <form onSubmit={generate} className="mt-3">
        <div className="field">
          <label htmlFor="gtopic">Topic</label>
          <select id="gtopic" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={Boolean(customTopic.trim())}>
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="hint">Or type your own:</div>
          <input
            type="text"
            maxLength={120}
            placeholder="Custom topic…"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="gplat">Platform</label>
            <select id="gplat" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="gcount">Variations</label>
            <select id="gcount" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={loading}>
            {loading ? "Working…" : "Generate"}
          </button>
        </div>
      </form>

      {drafts.length > 0 && (
        <div className="mt-3">
          <h3>Preview ({drafts.length})</h3>
          {drafts.map((d, i) => (
            <div className="card" key={i} style={{ marginBottom: 10 }}>
              <strong>{d.title}</strong>
              <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>
                {d.body}
              </p>
              {d.hashtags && <p className="tiny muted mb-0">{d.hashtags}</p>}
            </div>
          ))}
          <button className="btn btn-primary btn-block" onClick={saveAll} disabled={loading}>
            {loading ? "Saving…" : `Save ${drafts.length} draft(s)`}
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------ editor modal ------------------------------- */

function EditorModal({
  item,
  onClose,
  onSaved,
  toast,
}: {
  item: Content | null;
  onClose: () => void;
  onSaved: () => void;
  toast: (t: string, k?: "success" | "error" | "info") => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [platform, setPlatform] = useState(item?.platform ?? "X");
  const [hashtags, setHashtags] = useState(item?.hashtags ?? "");
  const [status, setStatus] = useState(item?.status ?? "Draft");
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (item?.scheduled_at) return item.scheduled_at.slice(0, 16);
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [publishUrl, setPublishUrl] = useState(item?.publish_url ?? "");
  const [failureReason, setFailureReason] = useState(item?.failure_reason ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { title, body, hashtags: hashtags || null };
      if (item) {
        const statusChanged = status !== item.status;
        if (statusChanged) {
          payload.status = status;
          if (status === "Scheduled") payload.scheduledAt = new Date(scheduledAt).toISOString();
          if (status === "Published") payload.publishUrl = publishUrl || null;
          if (status === "Failed") payload.failureReason = failureReason;
        }
        await api.patch(`/api/admin/growth/content/${item.id}`, payload);
      } else {
        payload.platform = platform;
        payload.status = "Draft";
        await api.post("/api/admin/growth/content", payload);
      }
      toast(item ? "Content updated" : "Draft created", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={item ? "Edit content" : "New draft"} onClose={onClose} wide>
      <div className="field">
        <label htmlFor="ctitle">Title *</label>
        <input id="ctitle" type="text" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="cbody">Content *</label>
        <textarea id="cbody" maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 180 }} />
      </div>
      {!item && (
        <div className="field">
          <label htmlFor="cplat">Platform</label>
          <select id="cplat" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="ctags">Hashtags</label>
        <input id="ctags" type="text" maxLength={500} value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
      </div>

      {item && (
        <>
          <div className="field">
            <label htmlFor="cstatus">Status</label>
            <select id="cstatus" value={status} onChange={(e) => setStatus(e.target.value)}>
              {["Draft", "Scheduled", "Published", "Failed"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <div className="hint">
              Status is your declaration: Published marks a post you have actually published; Failed needs a reason.
            </div>
          </div>
          {status === "Scheduled" && (
            <div className="field">
              <label htmlFor="csched">Scheduled date &amp; time *</label>
              <input
                id="csched"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>
          )}
          {status === "Published" && (
            <div className="field">
              <label htmlFor="curl">Post URL (optional)</label>
              <input
                id="curl"
                type="url"
                placeholder="https://…"
                value={publishUrl}
                onChange={(e) => setPublishUrl(e.target.value)}
              />
            </div>
          )}
          {status === "Failed" && (
            <div className="field">
              <label htmlFor="cfail">Failure reason *</label>
              <input
                id="cfail"
                type="text"
                maxLength={500}
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="e.g. API credentials missing; platform rejected media"
                required
              />
            </div>
          )}
        </>
      )}

      <div className="modal-actions">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : item ? "Save changes" : "Create draft"}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------ calendar tab ------------------------------- */

function CalendarTab({ items, reload, toast }: { items: Content[]; reload: () => void; toast: (t: string, k?: "success" | "error" | "info") => void }) {
  const days = useMemo(() => {
    const out: { date: Date; label: string; dow: string; items: Content[] }[] = [];
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // week starts Sunday
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        date: d,
        dow: d.toLocaleDateString("en-US", { weekday: "short" }),
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        items: items.filter((c) => c.scheduled_at && c.scheduled_at.slice(0, 10) === iso),
      });
    }
    return out;
  }, [items]);

  const unscheduled = items.filter((c) => c.status === "Draft" && !c.scheduled_at);

  async function markPublished(c: Content) {
    const url = window.prompt("Post URL (optional — paste the link to the published post):", "")?.trim() ?? null;
    try {
      await api.patch(`/api/admin/growth/content/${c.id}`, { status: "Published", publishUrl: url || undefined });
      toast(`“${c.title}” marked published`, "success");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed.", "error");
    }
  }

  return (
    <div>
      <div className="notice info tiny" style={{ marginBottom: 16 }}>
        This week (local dates). Items appear here once scheduled. Publishing to Instagram/X/Facebook requires an API
        connection — see the Platform connections tab; until then, publish manually and mark the item Published.
      </div>

      <div className="calendar">
        {days.map((d) => (
          <div className="cal-day" key={d.label}>
            <div className="dow">{d.dow}</div>
            <div className="date">{d.label}</div>
            {d.items.map((c) => (
              <div
                key={c.id}
                className={`cal-item ${c.status === "Published" ? "published" : c.status === "Failed" ? "failed" : ""}`}
                title={c.title}
              >
                {c.platform} · {c.title}
                <div className="tiny muted">{c.status}</div>
                {c.status === "Scheduled" && (
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 4, padding: "2px 7px", fontSize: "0.68rem" }} onClick={() => markPublished(c)}>
                    Mark published
                  </button>
                )}
              </div>
            ))}
            {!d.items.length && <div className="tiny muted">—</div>}
          </div>
        ))}
      </div>

      <h3 className="mt-4">Unscheduled drafts ({unscheduled.length})</h3>
      {!unscheduled.length ? (
        <EmptyState title="Nothing waiting" hint="Drafts with a scheduled date appear in the week above." />
      ) : (
        <div className="grid grid-3">
          {unscheduled.map((c) => (
            <div className="card" key={c.id}>
              <span className="badge">{c.platform}</span>
              <h3 className="mt-2" style={{ fontSize: "0.98rem" }}>
                {c.title}
              </h3>
              <p className="tiny muted" style={{ maxHeight: 70, overflow: "hidden" }}>
                {c.body}
              </p>
              <ScheduleInline id={c.id} onDone={() => { toast("Scheduled", "success"); reload(); }} toast={toast} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleInline({ id, onDone, toast }: { id: number; onDone: () => void; toast: (t: string, k?: "success" | "error" | "info") => void }) {
  const [when, setWhen] = useState(() => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16));
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        style={{ flex: 1, background: "var(--bg-2)", border: "1px solid var(--border-strong)", color: "var(--text)", borderRadius: 8, padding: "6px 8px", fontSize: "0.8rem" }}
        aria-label="Schedule date"
      />
      <button
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api.patch(`/api/admin/growth/content/${id}`, { status: "Scheduled", scheduledAt: new Date(when).toISOString() });
            onDone();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Scheduling failed.", "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        Schedule
      </button>
    </div>
  );
}

/* ----------------------------- campaigns tab ------------------------------- */

function CampaignsTab({
  campaigns,
  reload,
  toast,
}: {
  campaigns: Campaign[];
  reload: () => void;
  toast: (t: string, k?: "success" | "error" | "info") => void;
}) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState("");
  const [landing, setLanding] = useState("/get-started");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function trackedLink(c: Campaign): string {
    const params = new URLSearchParams();
    params.set("utm_source", c.utm_source);
    if (c.utm_medium) params.set("utm_medium", c.utm_medium);
    params.set("utm_campaign", c.utm_campaign);
    if (c.utm_content) params.set("utm_content", c.utm_content);
    return `${origin}${c.landing_path}?${params}`;
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await api.post("/api/admin/growth/campaigns", {
        name,
        utmSource: source,
        utmMedium: medium || null,
        utmCampaign: campaign || null,
        landingPath: landing,
      });
      toast("Campaign created", "success");
      setShow(false);
      setName("");
      setSource("");
      setCampaign("");
      reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed to create campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function copy(link: string, id: number) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(id);
      setTimeout(() => setCopied(null), 1600);
      toast("Link copied", "success");
    } catch {
      toast("Copy failed — select the link manually.", "error");
    }
  }

  return (
    <div>
      <div className="toolbar">
        <span className="small muted">Campaign links carry UTM parameters so registrations and clicks attribute correctly.</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={() => setShow(true)}>
          + New campaign
        </button>
      </div>

      {!campaigns.length ? (
        <EmptyState title="No campaigns yet" hint="Create one to get a tracked link for each promotion channel." />
      ) : (
        <div className="grid grid-2">
          {campaigns.map((c) => (
            <div className="card" key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <h3 style={{ fontSize: "1.05rem" }}>{c.name}</h3>
                <span className={`badge ${c.is_active ? "badge-green" : ""}`}>{c.is_active ? "active" : "paused"}</span>
              </div>
              <dl className="kv tiny">
                <dt>UTM source</dt>
                <dd>{c.utm_source}</dd>
                <dt>Medium / campaign</dt>
                <dd>
                  {c.utm_medium ?? "—"} / {c.utm_campaign}
                </dd>
                <dt>Landing</dt>
                <dd>{c.landing_path}</dd>
                <dt>Registrations</dt>
                <dd>{c.referrals}</dd>
                <dt>Telegram clicks</dt>
                <dd>{c.telegram_clicks}</dd>
                <dt>Confirmed conversions</dt>
                <dd className="strong">{c.confirmed_conversions}</dd>
              </dl>
              <div className="link-box mt-2">{trackedLink(c)}</div>
              <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => copy(trackedLink(c), c.id)}>
                  {copied === c.id ? "✓ Copied" : "Copy link"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    await api.patch(`/api/admin/growth/campaigns/${c.id}`, { isActive: !c.is_active });
                    reload();
                  }}
                >
                  {c.is_active ? "Pause" : "Activate"}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    if (!window.confirm(`Delete campaign “${c.name}”? Leads already attributed stay recorded.`)) return;
                    try {
                      await api.del(`/api/admin/growth/campaigns/${c.id}`);
                      toast("Campaign deleted", "success");
                      reload();
                    } catch (e) {
                      toast(e instanceof Error ? e.message : "Delete failed.", "error");
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {show && (
        <Modal title="Create campaign link" onClose={() => setShow(false)}>
          {err && <div className="form-error">{err}</div>}
          <form onSubmit={create}>
            <div className="field">
              <label htmlFor="cmpname">Campaign name *</label>
              <input id="cmpname" type="text" maxLength={100} placeholder="October Instagram push" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="cmpsrc">UTM source *</label>
                <input id="cmpsrc" type="text" maxLength={60} placeholder="instagram" value={source} onChange={(e) => setSource(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="cmpmed">UTM medium</label>
                <input id="cmpmed" type="text" maxLength={60} placeholder="social" value={medium} onChange={(e) => setMedium(e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="cmpcamp">UTM campaign</label>
                <input id="cmpcamp" type="text" maxLength={80} placeholder="fall_launch" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
                <div className="hint">Defaults to a slug of the campaign name.</div>
              </div>
              <div className="field">
                <label htmlFor="cmpland">Landing path</label>
                <input id="cmpland" type="text" maxLength={200} value={landing} onChange={(e) => setLanding(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShow(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------- connections tab ------------------------------ */

const CONNECTION_INFO: { key: string; name: string; requires: string[] }[] = [
  {
    key: "telegram",
    name: "Telegram",
    requires: [
      "Public contact links (t.me) work today with no credentials — visitors message the supervisor manually.",
      "Optional: a Telegram Bot API token if you later want automated posting to a channel.",
    ],
  },
  {
    key: "instagram",
    name: "Instagram",
    requires: [
      "A Meta developer app with Instagram API products",
      "An Instagram Business/Creator account linked to a Facebook Page",
      "Approved permissions (instagram_content_publish) for automated publishing",
    ],
  },
  {
    key: "x",
    name: "X (Twitter)",
    requires: ["An X developer app (project + app)", "API keys with write permission", "OAuth 1.0a or OAuth 2.0 user context"],
  },
  {
    key: "facebook",
    name: "Facebook",
    requires: ["A Meta developer app", "Pages API permissions", "A managed Page with publishing rights"],
  },
  {
    key: "email",
    name: "Email service",
    requires: [
      "An email service provider account (SMTP or API)",
      "An API key stored as a server secret — never in frontend code",
      "Verified sending domain (SPF/DKIM)",
    ],
  },
];

function ConnectionsTab({ toast }: { toast: (t: string, k?: "success" | "error" | "info") => void }) {
  const [statuses, setStatuses] = useState<Record<string, { status: string; notes?: string }> | null>(null);

  useEffect(() => {
    api
      .get<{ integrations: { name: string; raw: string }[] }>("/api/admin/reports/settings")
      .then((r) => {
        const map: Record<string, { status: string; notes?: string }> = {};
        for (const i of r.integrations) {
          try {
            map[i.name] = JSON.parse(i.raw);
          } catch {
            map[i.name] = { status: "not_connected" };
          }
        }
        setStatuses(map);
      })
      .catch(() => setStatuses({}));
  }, []);

  async function mark(key: string, status: "not_connected" | "connected", notes: string) {
    try {
      await api.put(`/api/admin/reports/integrations/${key}`, { status, notes });
      setStatuses((s) => ({ ...(s ?? {}), [key]: { status, notes } }));
      toast(status === "connected" ? `${key} marked connected` : `${key} reset`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed.", "error");
    }
  }

  if (!statuses) return <Loading label="Loading connection status…" />;

  return (
    <div>
      <div className="notice" style={{ marginBottom: 18 }}>
        <strong>Honest status board.</strong> This system does not connect to any social platform by itself. A platform
        is marked connected only after you add the required credentials on the server and confirm a successful
        connection — drafts and schedules work regardless, but publishing to Instagram, X, Facebook or email requires
        those external credentials.
      </div>

      <div className="grid grid-2">
        {CONNECTION_INFO.map((c) => {
          const st = statuses[c.key]?.status ?? "not_connected";
          const connected = st === "connected";
          return (
            <div className="card" key={c.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ marginBottom: 0 }}>{c.name}</h3>
                <StatusBadge status={st} />
              </div>
              <ul className="small muted" style={{ paddingLeft: 18, marginTop: 12 }}>
                {c.requires.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <p className="tiny muted">
                {connected
                  ? "Recorded as connected by you. Verify publishing works before relying on it."
                  : "Not connected. Scheduling and drafting work; automated publishing does not."}
              </p>
              <div className="toolbar" style={{ marginBottom: 0 }}>
                {!connected ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const notes = window.prompt(
                        `Confirm for ${c.name}: describe what you configured (e.g. "API keys added as secrets, test post succeeded"). Do not paste actual secrets:`,
                        "",
                      );
                      if (notes === null) return;
                      if (!notes.trim()) {
                        toast("A short confirmation note is required before marking connected.", "error");
                        return;
                      }
                      void mark(c.key, "connected", notes.trim());
                    }}
                  >
                    Mark connected (with note)
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => void mark(c.key, "not_connected", "Reset by admin")}>
                    Reset to not connected
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
