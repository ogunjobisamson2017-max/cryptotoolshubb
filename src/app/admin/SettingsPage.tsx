import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { Loading, useToast } from "./shared";

interface SettingsResp {
  settings: Record<string, string>;
  availableSettings: string[];
}

const LABELS: Record<string, string> = {
  telegram_username: "Supervisor Telegram username (no @)",
  referral_name: "Referral name shown in messages",
  brand_name: "Brand name",
  tagline: "Tagline",
  contact_email: "Public contact email (optional)",
  disclaimer_version: "Disclaimer version label",
};

export default function SettingsPage() {
  const toast = useToast();
  const [data, setData] = useState<SettingsResp | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    api
      .get<SettingsResp>("/api/admin/reports/settings")
      .then((r) => {
        setData(r);
        setForm({ ...r.settings });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings."));
  }, []);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await api.put<{ settings: Record<string, string> }>("/api/admin/reports/settings", form);
      setData((d) => (d ? { ...d, settings: r.settings } : d));
      toast("Settings saved", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      toast("Settings save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast("New passwords do not match.", "error");
      return;
    }
    setPwBusy(true);
    try {
      const r = await api.post<{ message: string }>("/api/admin/auth/change-password", {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      toast(r.message, "success");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Password change failed.", "error");
    } finally {
      setPwBusy(false);
    }
  }

  if (!data && !error) return <Loading label="Loading settings…" />;

  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <div>
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>Brand &amp; referral settings</h3>
        </div>
        {error && <div className="form-error">{error}</div>}
        <form className="card" onSubmit={saveSettings}>
          {(data?.availableSettings ?? Object.keys(LABELS)).map((key) => (
            <div className="field" key={key}>
              <label htmlFor={`set-${key}`}>{LABELS[key] ?? key}</label>
              <input
                id={`set-${key}`}
                type="text"
                maxLength={300}
                value={form[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
              {key === "telegram_username" && (
                <div className="hint">
                  Used to build every Telegram link (t.me/&lt;username&gt;). Change only to a verified account.
                </div>
              )}
              {key === "referral_name" && (
                <div className="hint">Included in the prefilled message: “Referral name: …”.</div>
              )}
            </div>
          ))}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </form>

        <div className="notice info tiny mt-3">
          Changes here immediately affect public pages, Telegram links and the prefilled referral message. The public
          site never exposes secrets — only these non-sensitive display values.
        </div>
      </div>

      <div>
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>Security</h3>
        </div>
        <form className="card" onSubmit={changePassword}>
          <div className="field">
            <label htmlFor="curpw">Current password</label>
            <input
              id="curpw"
              type="password"
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="newpw">New password</label>
            <input
              id="newpw"
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
            />
            <div className="hint">12+ characters with a letter and a number. Changing it signs out other sessions.</div>
          </div>
          <div className="field">
            <label htmlFor="confirmpw">Confirm new password</label>
            <input
              id="confirmpw"
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-secondary" type="submit" disabled={pwBusy}>
            {pwBusy ? "Updating…" : "Change password"}
          </button>
        </form>

        <div className="card mt-3">
          <h3>What this system stores</h3>
          <ul className="small muted" style={{ paddingLeft: 18 }}>
            <li>Leads: name, email, country, interest, consent record, referral ID, attribution</li>
            <li>Referral activity: Telegram click events with timestamps</li>
            <li>Sales &amp; commissions you record manually (with verification source)</li>
            <li>Content drafts, schedules and publishing declarations</li>
            <li>Campaign definitions and UTM parameters</li>
            <li>Administrative audit log of every sensitive action</li>
            <li>Server security logs (IP, user agent) for abuse prevention</li>
          </ul>
          <p className="tiny muted mb-0">
            Never stored: user passwords (only hashed credentials for admins), bank details, seed phrases, private keys
            or verification codes.
          </p>
        </div>
      </div>
    </div>
  );
}
