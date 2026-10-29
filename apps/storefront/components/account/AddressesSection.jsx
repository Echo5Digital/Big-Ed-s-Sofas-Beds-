"use client";

import { useEffect, useId, useState } from "react";
import { Plus } from "lucide-react";
import {
  listAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  isSessionExpired,
} from "@/lib/api/customerAccount";
import {
  Field,
  Notice,
  describeError,
  linkButtonClass,
  secondaryButtonClass,
  smallPrimaryButtonClass,
} from "@/components/account/formParts";

// Mirrors MAX_ADDRESSES in apps/api's customerAccount.service.js; the API is the
// one that actually enforces it, this only hides the button once it's reached.
const MAX_ADDRESSES = 10;

const EMPTY_FORM = { line1: "", line2: "", city: "", state: "", postalCode: "", isDefault: false };

function AddressLines({ address }) {
  return (
    <address className="text-sm not-italic leading-relaxed text-brand-charcoal">
      <span className="block font-semibold">{address.line1}</span>
      {address.line2 ? <span className="block">{address.line2}</span> : null}
      <span className="block">
        {address.city}, {address.state} {address.postalCode}
      </span>
      {address.country && address.country !== "US" ? <span className="block">{address.country}</span> : null}
    </address>
  );
}

export default function AddressesSection({ onSessionExpired }) {
  const uid = useId();
  const [addresses, setAddresses] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // null = no form open, "new" = adding, otherwise the id being edited.
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const setField = (name) => (value) => setForm((current) => ({ ...current, [name]: value }));

  useEffect(() => {
    let cancelled = false;
    listAddresses()
      .then((loaded) => {
        if (!cancelled) setAddresses(loaded);
      })
      .catch((error) => {
        if (cancelled) return;
        if (isSessionExpired(error)) onSessionExpired();
        else setLoadError(describeError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, onSessionExpired]);

  // Runs one change, then reports the outcome. Any failure other than an
  // expired session is shown inline and leaves the screen as it was.
  async function run(action, successMessage) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      if (successMessage) setNotice({ type: "success", message: successMessage });
      return true;
    } catch (error) {
      if (isSessionExpired(error)) onSessionExpired();
      else setNotice({ type: "error", message: describeError(error) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openForm(id, values) {
    setForm(values);
    setEditingId(id);
    setConfirmingDeleteId(null);
    setNotice(null);
  }

  function closeForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const isNew = editingId === "new";
    return run(async () => {
      if (isNew) await createAddress(form);
      else await updateAddress(editingId, form);
      // Saving can move the default onto this address, so re-read the list
      // rather than patching the one row.
      setAddresses(await listAddresses());
      closeForm();
    }, isNew ? "Address added." : "Address updated.");
  }

  function handleMakeDefault(id) {
    return run(async () => {
      setAddresses(await setDefaultAddress(id));
    }, "Default address updated.");
  }

  function handleDelete(id) {
    return run(async () => {
      setAddresses(await deleteAddress(id));
      setConfirmingDeleteId(null);
    }, "Address removed.");
  }

  if (loadError) {
    return (
      <div>
        <Notice notice={{ type: "error", message: loadError }} className="" />
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            setReloadKey((key) => key + 1);
          }}
          className={`${linkButtonClass} mt-3`}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!addresses) {
    return (
      <p role="status" aria-busy="true" className="text-sm text-brand-charcoal/60">
        Loading&hellip;
      </p>
    );
  }

  const editingAddress = editingId && editingId !== "new" ? addresses.find((a) => a.id === editingId) : null;
  const canMakeDefault = editingId === "new" ? addresses.length > 0 : editingAddress ? !editingAddress.isDefault : false;
  const atLimit = addresses.length >= MAX_ADDRESSES;

  const addressForm = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="font-display text-base font-bold text-brand-charcoal">
        {editingId === "new" ? "Add a New Address" : "Edit Address"}
      </h3>
      <Field
        id={`${uid}-line1`}
        label="Street Address"
        autoComplete="address-line1"
        required
        maxLength={200}
        value={form.line1}
        onChange={setField("line1")}
      />
      <Field
        id={`${uid}-line2`}
        label="Apartment, Suite, etc. (optional)"
        autoComplete="address-line2"
        maxLength={200}
        value={form.line2}
        onChange={setField("line2")}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <Field
            id={`${uid}-city`}
            label="City"
            autoComplete="address-level2"
            required
            maxLength={120}
            value={form.city}
            onChange={setField("city")}
          />
        </div>
        <div className="sm:col-span-1">
          <Field
            id={`${uid}-state`}
            label="State"
            autoComplete="address-level1"
            required
            maxLength={60}
            value={form.state}
            onChange={setField("state")}
          />
        </div>
        <div className="sm:col-span-2">
          <Field
            id={`${uid}-zip`}
            label="ZIP Code"
            autoComplete="postal-code"
            required
            maxLength={20}
            value={form.postalCode}
            onChange={setField("postalCode")}
          />
        </div>
      </div>
      {canMakeDefault ? (
        <label className="flex items-center gap-2 text-sm text-brand-charcoal">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) => setField("isDefault")(event.target.checked)}
            className="size-4 accent-brand-red"
          />
          Make this my default address
        </label>
      ) : null}
      {editingId === "new" && addresses.length === 0 ? (
        <p className="text-xs text-brand-charcoal/60">Your first address is saved as your default.</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={smallPrimaryButtonClass}>
          {busy ? "Saving…" : "Save Address"}
        </button>
        <button type="button" onClick={closeForm} disabled={busy} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="max-w-2xl">
      <Notice notice={notice} className="mb-4" />

      {editingId === "new" ? (
        <div className="rounded-xl border border-brand-charcoal/15 p-5">{addressForm}</div>
      ) : atLimit ? (
        <p className="rounded-xl border border-brand-charcoal/10 bg-brand-charcoal/5 px-5 py-4 text-sm text-brand-charcoal/70">
          You&apos;ve saved the maximum of {MAX_ADDRESSES} addresses. Remove one to add another.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => openForm("new", EMPTY_FORM)}
          disabled={busy}
          className="flex w-full items-center gap-3 rounded-xl border border-brand-charcoal/15 px-5 py-4 text-left text-sm font-semibold text-brand-red transition-colors hover:bg-brand-red/5 focus-visible:outline-2 focus-visible:outline-brand-red disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a New Address
        </button>
      )}

      {addresses.length === 0 && editingId !== "new" ? (
        <p className="mt-6 text-sm text-brand-charcoal/60">You haven&apos;t saved any addresses yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-xl border border-brand-charcoal/15 p-5">
              {editingId === address.id ? (
                addressForm
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <AddressLines address={address} />
                    {address.isDefault ? (
                      <span className="shrink-0 rounded-full bg-brand-gold/20 px-2.5 py-0.5 text-xs font-semibold text-brand-charcoal">
                        Default
                      </span>
                    ) : null}
                  </div>

                  {confirmingDeleteId === address.id ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-brand-charcoal/80">Delete this address?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(address.id)}
                        disabled={busy}
                        className="rounded-full bg-brand-red px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        disabled={busy}
                        className={linkButtonClass}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          openForm(address.id, {
                            line1: address.line1,
                            line2: address.line2 ?? "",
                            city: address.city,
                            state: address.state,
                            postalCode: address.postalCode,
                            isDefault: false,
                          })
                        }
                        disabled={busy}
                        className={linkButtonClass}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setConfirmingDeleteId(address.id);
                        }}
                        disabled={busy}
                        className={linkButtonClass}
                      >
                        Delete
                      </button>
                      {!address.isDefault ? (
                        <button
                          type="button"
                          onClick={() => handleMakeDefault(address.id)}
                          disabled={busy}
                          className={linkButtonClass}
                        >
                          Make default
                        </button>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
