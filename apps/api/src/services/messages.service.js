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
    createdAt: message.createdAt,
  };
}

async function createMessage({ name, email, message }) {
  const created = await prisma.contactMessage.create({ data: { name, email, message } });
  return serializeMessage(created);
}

// Default admin list excludes ARCHIVED — staff explicitly archives a message
// to dismiss it from the working inbox view without deleting the record.
async function listMessages() {
  const messages = await prisma.contactMessage.findMany({
    where: { status: { not: "ARCHIVED" } },
    // Important first, then newest — the two things staff triage by.
    orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
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
  listMessages,
  countUnreadAndImportant,
  markRead,
  setImportant,
  archiveMessage,
  deleteMessage,
};
