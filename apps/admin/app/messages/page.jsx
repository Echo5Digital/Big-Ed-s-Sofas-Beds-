"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Archive, Trash2, Mail, MailOpen, Undo2, ChevronDown, Paperclip } from "lucide-react";
import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/useAuth";

// /contact form submissions. Same "staff can act, never edit" rule as
// ProductReviewsTab.jsx: a message's name/email/body are exactly what the
// customer sent. Important-first, then newest first (see
// messages.service.js listMessages) — that's what staff need to triage.
function MessagesContent() {
  const { hasPermission } = useAuth();
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  // Separate from the mark-read click below — only Return requests carry
  // extra detail (order reference / attachment) worth collapsing by default,
  // so a plain message never needs this state at all.
  const [detailOpenId, setDetailOpenId] = useState(null);
  const canWrite = hasPermission("messages:write");

  const load = useCallback(() => {
    api
      .get("/messages")
      .then((data) => setMessages(data.messages))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load messages."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Opening a NEW message marks it read — mirrors a normal email inbox,
  // rather than needing a separate "mark as read" click for every message.
  async function handleToggleOpen(message) {
    if (message.status !== "NEW") return;
    setError(null);
    try {
      const data = await api.patch(`/messages/${message.id}/read`, {});
      setMessages((prev) => prev.map((m) => (m.id === message.id ? data.message : m)));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to mark message read.");
    }
  }

  async function handleToggleImportant(message) {
    setActioningId(message.id);
    setError(null);
    try {
      const data = await api.patch(`/messages/${message.id}/important`, { isImportant: !message.isImportant });
      setMessages((prev) => prev.map((m) => (m.id === message.id ? data.message : m)));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update message.");
    } finally {
      setActioningId(null);
    }
  }

  async function handleArchive(message) {
    setActioningId(message.id);
    setError(null);
    try {
      await api.patch(`/messages/${message.id}/archive`, {});
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to archive message.");
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete(message) {
    setActioningId(message.id);
    setError(null);
    try {
      await api.delete(`/messages/${message.id}`);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete message.");
    } finally {
      setActioningId(null);
    }
  }

  const unreadCount = messages?.filter((m) => m.status === "NEW").length ?? 0;

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle={messages ? `${unreadCount} unread · ${messages.length} total` : "Contact form submissions"}
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {messages === null ? (
        <p className="text-sm text-brand-charcoal/50">Loading messages…</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-brand-charcoal/60">No messages yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((message) => {
            const isReturn = message.isReturnRequest;
            const isDetailOpen = detailOpenId === message.id;
            return (
            <li
              key={message.id}
              onClick={() => handleToggleOpen(message)}
              className={`flex flex-col gap-2 rounded-xl border p-4 ${
                isReturn
                  ? "cursor-pointer border-red-200 bg-red-50"
                  : message.status === "NEW"
                    ? "cursor-pointer border-brand-gold-dark/30 bg-brand-gold/5"
                    : "border-black/10"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {message.status === "NEW" ? (
                    <Mail className="size-4 text-brand-gold-dark" aria-hidden="true" />
                  ) : (
                    <MailOpen className="size-4 text-brand-charcoal/40" aria-hidden="true" />
                  )}
                  <Badge tone={message.status === "NEW" ? "warning" : "default"}>
                    {message.status === "NEW" ? "Unread" : "Read"}
                  </Badge>
                  {message.isImportant && <Badge tone="danger">Important</Badge>}
                  {isReturn && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                      <Undo2 className="size-3.5" aria-hidden="true" />
                      Return
                    </span>
                  )}
                </div>
                <p className="text-xs text-brand-charcoal/50">{new Date(message.createdAt).toLocaleString()}</p>
              </div>

              <p className="text-sm font-semibold text-brand-charcoal">{message.name}</p>
              <p className="text-xs text-brand-charcoal/60">{message.email}</p>
              <p className="text-sm whitespace-pre-wrap text-brand-charcoal">{message.message}</p>

              {isReturn && (
                <div onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setDetailOpenId((prev) => (prev === message.id ? null : message.id))}
                    className="inline-flex items-center gap-1 self-start text-xs font-semibold text-red-700 hover:text-red-800"
                  >
                    <ChevronDown
                      className={`size-3.5 transition-transform ${isDetailOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                    {isDetailOpen ? "Hide return details" : "View return details"}
                  </button>

                  {isDetailOpen && (
                    <dl className="mt-2 flex flex-col gap-2 rounded-lg border border-red-200 bg-white p-3 text-sm">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-semibold text-brand-charcoal">Order reference:</dt>
                        <dd className="text-brand-charcoal/80">{message.returnOrderReference || "Not provided"}</dd>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2">
                        <dt className="font-semibold text-brand-charcoal">Attachment:</dt>
                        <dd>
                          {message.returnAttachmentUrl ? (
                            <a
                              href={message.returnAttachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-brand-red hover:text-brand-red-dark"
                            >
                              <Paperclip className="size-3.5" aria-hidden="true" />
                              View file
                            </a>
                          ) : (
                            <span className="text-brand-charcoal/60">None</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              )}

              {canWrite && (
                <div
                  className="mt-1 flex flex-wrap gap-2"
                  // Prevent the row's own open/mark-read click from firing
                  // when an action button inside it is clicked.
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    icon={Star}
                    onClick={() => handleToggleImportant(message)}
                    disabled={actioningId === message.id}
                  >
                    {message.isImportant ? "Unmark Important" : "Mark Important"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={Archive}
                    onClick={() => handleArchive(message)}
                    disabled={actioningId === message.id}
                  >
                    Archive
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={Trash2}
                    onClick={() => handleDelete(message)}
                    disabled={actioningId === message.id}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <RequireAuth permission="messages:read">
      <MessagesContent />
    </RequireAuth>
  );
}
