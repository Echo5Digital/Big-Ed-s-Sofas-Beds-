"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Archive, Trash2, Mail, MailOpen } from "lucide-react";
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
          {messages.map((message) => (
            <li
              key={message.id}
              onClick={() => handleToggleOpen(message)}
              className={`flex flex-col gap-2 rounded-xl border p-4 ${
                message.status === "NEW" ? "cursor-pointer border-brand-gold-dark/30 bg-brand-gold/5" : "border-black/10"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {message.status === "NEW" ? (
                    <Mail className="size-4 text-brand-gold-dark" aria-hidden="true" />
                  ) : (
                    <MailOpen className="size-4 text-brand-charcoal/40" aria-hidden="true" />
                  )}
                  <Badge tone={message.status === "NEW" ? "warning" : "default"}>
                    {message.status === "NEW" ? "Unread" : "Read"}
                  </Badge>
                  {message.isImportant && <Badge tone="danger">Important</Badge>}
                </div>
                <p className="text-xs text-brand-charcoal/50">{new Date(message.createdAt).toLocaleString()}</p>
              </div>

              <p className="text-sm font-semibold text-brand-charcoal">{message.name}</p>
              <p className="text-xs text-brand-charcoal/60">{message.email}</p>
              <p className="text-sm whitespace-pre-wrap text-brand-charcoal">{message.message}</p>

              {canWrite && (
                <div
                  className="mt-1 flex gap-2"
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
          ))}
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
