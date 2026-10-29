"use client";

import { useId, useState } from "react";
import { LogOut } from "lucide-react";
import { changePassword, isSessionExpired } from "@/lib/api/customerAccount";
import { Notice, PasswordField, describeError, smallPrimaryButtonClass } from "@/components/account/formParts";

const EMPTY_FORM = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function SettingsSection({ onSessionExpired, onSignOut, signingOut }) {
  const uid = useId();
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const setField = (name) => (value) => setForm((current) => ({ ...current, [name]: value }));

  async function handleChangePassword(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setNotice({ type: "error", message: "The new passwords don't match." });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm(EMPTY_FORM);
      setNotice({ type: "success", message: "Your password has been changed." });
    } catch (error) {
      if (isSessionExpired(error)) {
        onSessionExpired();
        return;
      }
      // Keep what they typed for the new password; a wrong current password is
      // the common failure and clearing only that field is enough to retry.
      setForm((current) => ({ ...current, currentPassword: "" }));
      setNotice({ type: "error", message: describeError(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-10">
      <section aria-labelledby={`${uid}-password-heading`}>
        <h3 id={`${uid}-password-heading`} className="font-display text-lg font-bold text-brand-charcoal">
          Change Password
        </h3>
        <p className="mt-1 text-sm text-brand-charcoal/60">Enter your current password, then choose a new one.</p>

        <Notice notice={notice} />

        <form onSubmit={handleChangePassword} className="mt-5 flex flex-col gap-4">
          <PasswordField
            id={`${uid}-current`}
            label="Current Password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={setField("currentPassword")}
          />
          <PasswordField
            id={`${uid}-new`}
            label="New Password"
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters."
            value={form.newPassword}
            onChange={setField("newPassword")}
          />
          <PasswordField
            id={`${uid}-confirm`}
            label="Confirm New Password"
            autoComplete="new-password"
            minLength={8}
            value={form.confirmPassword}
            onChange={setField("confirmPassword")}
          />
          <div>
            <button type="submit" disabled={busy} className={smallPrimaryButtonClass}>
              {busy ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby={`${uid}-signout-heading`} className="border-t border-brand-charcoal/10 pt-8">
        <h3 id={`${uid}-signout-heading`} className="font-display text-lg font-bold text-brand-charcoal">
          Sign Out
        </h3>
        <p className="mt-1 text-sm text-brand-charcoal/60">Sign out of your account on this device.</p>
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="mt-4 flex items-center gap-2 rounded-full border border-brand-charcoal/20 px-6 py-2.5 text-sm font-semibold text-brand-charcoal transition-colors hover:bg-brand-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="size-4" aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign Out"}
        </button>
      </section>
    </div>
  );
}
