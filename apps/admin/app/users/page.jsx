"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import CustomersTab from "@/components/users/CustomersTab";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/useAuth";

// SUPER_ADMIN is deliberately absent — it's never assignable from this UI,
// so no admin (even one with users:manage) can grant themselves or anyone
// else that tier. It's only ever set directly in the database.
const ROLE_OPTIONS = ["ADMIN", "MANAGER", "SALESMAN", "CASHIER"];

// Mirrors the pos:register:approve-reopen permission grants (see
// apps/api/src/lib/posPin.js's verifyManagerPin and the matching guard on
// PATCH /:id/pin) — only these roles can ever authorize a POS discount
// override, so a PIN is meaningless for anyone else and the section is
// hidden rather than offered and then rejected by the API.
const PIN_ELIGIBLE_ROLES = ["ADMIN", "MANAGER", "SUPER_ADMIN"];

const ROLE_TONE = {
  // Not in ROLE_OPTIONS above, but still needs a tone for when a Super
  // Admin's own row renders its own badge (the API lets that one row
  // through to its own caller — see users.routes.js's isHiddenFromCaller).
  SUPER_ADMIN: "danger",
  ADMIN: "danger",
  MANAGER: "info",
  SALESMAN: "default",
  CASHIER: "success",
};

function RoleCheckboxes({ value, onChange, disabled }) {
  function toggle(role) {
    if (value.includes(role)) {
      onChange(value.filter((r) => r !== role));
    } else {
      onChange([...value, role]);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {ROLE_OPTIONS.map((role) => (
        <label
          key={role}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
            value.includes(role) ? "border-brand-red bg-brand-red/5 text-brand-red-dark" : "border-black/15 text-brand-charcoal"
          } ${disabled ? "opacity-50" : "cursor-pointer"}`}
        >
          <input
            type="checkbox"
            checked={value.includes(role)}
            onChange={() => toggle(role)}
            disabled={disabled}
            className="size-4 accent-brand-red"
          />
          {role}
        </label>
      ))}
    </div>
  );
}

function NewUserModal({ open, onClose, onDone }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleNames, setRoleNames] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setRoleNames([]);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (roleNames.length === 0) {
      setError("Select at least one role.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/users", { email, password, firstName, lastName, roleNames });
      reset();
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New User"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-charcoal">First name</label>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-charcoal">Last name</label>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Initial password</label>
          <input
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
          <p className="text-xs text-brand-charcoal/50">Share this with the new user directly — they aren&apos;t emailed automatically.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-charcoal">Roles</label>
          <RoleCheckboxes value={roleNames} onChange={setRoleNames} />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create User"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PosPinSection({ user, onDone }) {
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);

    if (!/^\d{4,6}$/.test(pin)) {
      setError("PIN must be 4-6 digits.");
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/users/${user.id}/pin`, { pin });
      setPin("");
      setEditing(false);
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update PIN.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-t border-black/10 pt-4">
      <p className="text-sm font-medium text-brand-charcoal">
        POS discount PIN:{" "}
        <span className="font-normal text-brand-charcoal/60">
          {user.posPinUpdatedAt ? `set — updated ${new Date(user.posPinUpdatedAt).toLocaleDateString()}` : "not set"}
        </span>
      </p>
      <p className="mt-1 text-xs text-brand-charcoal/50">
        Used to authorize a POS discount above 10% from the register screen. Separate from the login password.
      </p>

      {editing ? (
        <form onSubmit={handleSave} className="mt-3 flex flex-col gap-2">
          <input
            type="password"
            inputMode="numeric"
            placeholder="4-6 digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Saving…" : "Save PIN"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(false); setPin(""); setError(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setEditing(true)}>
          Set/Reset PIN
        </Button>
      )}
    </div>
  );
}

function PasswordResetSection({ user, onDone }) {
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/users/${user.id}/password`, { password });
      setPassword("");
      setEditing(false);
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-t border-black/10 pt-4">
      <p className="text-sm font-medium text-brand-charcoal">Login password</p>
      <p className="mt-1 text-xs text-brand-charcoal/50">
        Sets a new login password for this account. The user isn&apos;t notified — share the new password with them
        directly.
      </p>

      {editing ? (
        <form onSubmit={handleSave} className="mt-3 flex flex-col gap-2">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Saving…" : "Save Password"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(false); setPassword(""); setError(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setEditing(true)}>
          Change Password
        </Button>
      )}
    </div>
  );
}

function EditUserModal({ user, isSelf, onClose, onDone }) {
  const [roleNames, setRoleNames] = useState(user?.roles ?? []);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  async function handleSaveRoles(e) {
    e.preventDefault();
    setError(null);

    if (roleNames.length === 0) {
      setError("Select at least one role.");
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/users/${user.id}/roles`, { roleNames });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update roles.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive() {
    setError(null);
    setTogglingActive(true);
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update account status.");
    } finally {
      setTogglingActive(false);
    }
  }

  if (!user) return null;

  return (
    <Modal open={Boolean(user)} onClose={onClose} title={`${user.firstName} ${user.lastName}`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-brand-charcoal/60">{user.email}</p>

        <form onSubmit={handleSaveRoles} className="flex flex-col gap-3">
          <label className="text-sm font-medium text-brand-charcoal">Roles</label>
          <RoleCheckboxes value={roleNames} onChange={setRoleNames} />

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button type="submit" disabled={submitting} className="self-start">
            {submitting ? "Saving…" : "Save Roles"}
          </Button>
        </form>

        {user.roles.some((role) => PIN_ELIGIBLE_ROLES.includes(role)) && <PosPinSection user={user} onDone={onDone} />}

        <PasswordResetSection user={user} onDone={onDone} />

        <div className="border-t border-black/10 pt-4">
          {isSelf ? (
            <p className="text-sm text-brand-charcoal/50">You can&apos;t deactivate your own account.</p>
          ) : (
            <Button
              type="button"
              variant={user.isActive ? "outline" : "primary"}
              disabled={togglingActive}
              onClick={handleToggleActive}
            >
              {togglingActive ? "Saving…" : user.isActive ? "Deactivate Account" : "Reactivate Account"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function UsersContent() {
  const { user: currentUser, hasPermission, refresh: refreshCurrentUser } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [tab, setTab] = useState("staff");

  const load = useCallback(() => {
    api
      .get("/users")
      .then((data) => setUsers(data.users))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load users."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleChanged() {
    setCreateOpen(false);
    setEditingUser(null);
    load();
    // If the signed-in admin just edited their own roles/status, the admin
    // app's own hasPermission() checks are driven by the AuthProvider's
    // in-memory user snapshot (see useAuth.js) and won't reflect the change
    // until re-fetched — the API itself already enforces the new permissions
    // instantly on the next request regardless.
    if (currentUser && editingUser?.id === currentUser.id) {
      refreshCurrentUser();
    }
  }

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (u) => (
        <span className="font-semibold">
          {u.firstName} {u.lastName}
          {currentUser?.id === u.id && <span className="ml-2 text-xs font-normal text-brand-charcoal/40">(you)</span>}
        </span>
      ),
    },
    { key: "email", header: "Email" },
    {
      key: "employeeId",
      header: "Employee ID",
      render: (u) => (u.employeeId ? <span className="font-mono text-xs font-semibold text-brand-charcoal/70">{u.employeeId}</span> : "—"),
    },
    {
      key: "roles",
      header: "Roles",
      render: (u) => (
        <div className="flex flex-wrap gap-1.5">
          {u.roles.map((role) => (
            <Badge key={role} tone={ROLE_TONE[role] ?? "default"}>
              {role}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (u) => <Badge tone={u.isActive ? "success" : "danger"}>{u.isActive ? "Active" : "Deactivated"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      render: (u) => (
        <Button variant="outline" size="sm" onClick={() => setEditingUser(u)}>
          Manage
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={
          tab === "staff"
            ? "Staff accounts and role-based access control"
            : "Customers who registered an account on the storefront"
        }
        action={
          tab === "staff" &&
          hasPermission("users:manage") && (
            <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>
              New User
            </Button>
          )
        }
      />

      <div role="tablist" aria-label="Users" className="mb-6 flex gap-1 border-b border-black/10">
        {[
          ["staff", "Staff"],
          ["customers", "Customers"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-red ${
              tab === key
                ? "border-brand-red text-brand-red"
                : "border-transparent text-brand-charcoal/60 hover:text-brand-charcoal"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "staff" ? (
        <>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <DataTable columns={columns} rows={users} emptyMessage="No users yet." rowHref={(u) => `/users/${u.id}`} />

          <NewUserModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={handleChanged} />

          <EditUserModal
            key={editingUser?.id}
            user={editingUser}
            isSelf={Boolean(currentUser && editingUser && currentUser.id === editingUser.id)}
            onClose={() => setEditingUser(null)}
            onDone={handleChanged}
          />
        </>
      ) : (
        <CustomersTab />
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <RequireAuth permission="users:manage">
      <UsersContent />
    </RequireAuth>
  );
}
