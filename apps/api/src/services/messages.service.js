const { prisma } = require("@big-eds/database");
const { NotFoundError } = require("../lib/errors");

// The storefront /contact form's inbox — a guest-submitted inquiry, not tied
// to a signed-in Customer account (same free-text-author convention as
// Review; see schema.prisma's ContactMessage comment).

function serializeMessage(message) {
  return {
    id: message.id,
    name: message.name,
    email: message.email,
    message: message.message,
    status: message.status,
    isImportant: message.isImportant,
    isReturnRequest: message.isReturnRequest,
    returnOrderReference: message.returnOrderReference,
    returnAttachmentUrl: message.returnAttachmentUrl,
    createdAt: message.createdAt,
  };
}

async function createMessage({ name, email, message }) {
  const created = await prisma.contactMessage.create({ data: { name, email, message } });
  return serializeMessage(created);
}

// Storefront My Orders "Request Return" flow (POST /messages/return) — a
// return request is a ContactMessage with isReturnRequest: true plus the
// order reference the customer typed and/or the Cloudinary URL of a file
// they attached; see the ContactMessage model comment in schema.prisma for
// why this isn't a new table.
async function createReturnMessage({
  name,
  email,
  message,
  returnOrderReference,
  returnAttachmentUrl,
  returnAttachmentPublicId,
}) {
  const created = await prisma.contactMessage.create({
    data: {
      name,
      email,
      message,
      isReturnRequest: true,
      returnOrderReference,
      returnAttachmentUrl,
      returnAttachmentPublicId,
    },
  });
  return serializeMessage(created);
}

// Default admin list excludes ARCHIVED — staff explicitly archives a message
// to dismiss it from the working inbox view without deleting the record.
// Hard-capped (same convention as orders.routes.js/reports.routes.js) —
// previously had no take at all, so every non-archived message ever
// submitted (contact form + Return requests) loaded on every inbox view.
// No pagination UI exists for Messages yet, so a cap for now; staff archive
// messages to keep the working inbox well under this anyway.
async function listMessages() {
  const messages = await prisma.contactMessage.findMany({
    where: { status: { not: "ARCHIVED" } },
    // Important first, then newest — the two things staff triage by.
    orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return messages.map(serializeMessage);
}

async function countUnreadAndImportant() {
  const [unread, important, total] = await Promise.all([
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.contactMessage.count({ where: { isImportant: true, status: { not: "ARCHIVED" } } }),
    prisma.contactMessage.count(),
  ]);
  return { unread, important, total };
}

async function findOwnedMessage(id) {
  const message = await prisma.contactMessage.findUnique({ where: { id } });
  if (!message) throw new NotFoundError("Message not found");
  return message;
}

async function markRead(id) {
  await findOwnedMessage(id);
  const updated = await prisma.contactMessage.update({ where: { id }, data: { status: "READ" } });
  return serializeMessage(updated);
}

async function setImportant(id, isImportant) {
  await findOwnedMessage(id);
  const updated = await prisma.contactMessage.update({ where: { id }, data: { isImportant } });
  return serializeMessage(updated);
}

async function archiveMessage(id) {
  await findOwnedMessage(id);
  const updated = await prisma.contactMessage.update({ where: { id }, data: { status: "ARCHIVED" } });
  return serializeMessage(updated);
}

async function deleteMessage(id) {
  await findOwnedMessage(id);
  await prisma.contactMessage.delete({ where: { id } });
}

module.exports = {
  createMessage,
  createReturnMessage,
  listMessages,
  countUnreadAndImportant,
  markRead,
  setImportant,
  archiveMessage,
  deleteMessage,
};
