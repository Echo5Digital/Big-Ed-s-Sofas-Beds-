const { prisma } = require("@big-eds/database");
const service = require("./messages.service");

// Runs against the real dev database (same convention as the other service
// tests — no Prisma mock layer). Every row is tagged with a per-run prefix
// and removed by exact id/prefix in afterAll.
const RUN = Date.now();
const emailPrefix = `messages-test-${RUN}`;
let counter = 0;

async function newMessage(overrides = {}) {
  counter += 1;
  return prisma.contactMessage.create({
    data: {
      name: "Test Customer",
      email: `${emailPrefix}-${counter}@example.com`,
      message: "Hello, I have a question.",
      ...overrides,
    },
  });
}

afterAll(async () => {
  await prisma.contactMessage.deleteMany({ where: { email: { startsWith: emailPrefix } } });
});

describe("messages.service — createMessage", () => {
  it("creates a message with NEW status and isImportant false by default", async () => {
    const result = await service.createMessage({
      name: "Jane Doe",
      email: `${emailPrefix}-create@example.com`,
      message: "Do you deliver to Austin?",
    });

    expect(result).toMatchObject({
      name: "Jane Doe",
      email: `${emailPrefix}-create@example.com`,
      message: "Do you deliver to Austin?",
      status: "NEW",
      isImportant: false,
    });
    expect(result.id).toBeTruthy();
  });
});

describe("messages.service — listMessages", () => {
  it("excludes ARCHIVED messages", async () => {
    const visible = await newMessage();
    const archived = await newMessage({ status: "ARCHIVED" });

    const messages = await service.listMessages();
    const ids = messages.map((m) => m.id);

    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(archived.id);
  });

  it("orders important messages first, then newest first", async () => {
    const older = await newMessage({ createdAt: new Date(Date.now() - 60_000) });
    const newer = await newMessage();
    const important = await newMessage({ isImportant: true, createdAt: new Date(Date.now() - 120_000) });

    const messages = await service.listMessages();
    const ids = messages.map((m) => m.id);
    const importantIndex = ids.indexOf(important.id);
    const newerIndex = ids.indexOf(newer.id);
    const olderIndex = ids.indexOf(older.id);

    expect(importantIndex).toBeLessThan(newerIndex);
    expect(newerIndex).toBeLessThan(olderIndex);
  });
});

describe("messages.service — countUnreadAndImportant", () => {
  it("counts NEW as unread, excludes ARCHIVED from important, and counts everything in total", async () => {
    const before = await service.countUnreadAndImportant();

    await newMessage(); // NEW, not important
    await newMessage({ isImportant: true }); // NEW, important
    await newMessage({ status: "READ", isImportant: true }); // READ, important
    await newMessage({ status: "ARCHIVED", isImportant: true }); // ARCHIVED, important — excluded from important count

    const after = await service.countUnreadAndImportant();

    expect(after.unread - before.unread).toBe(2);
    expect(after.important - before.important).toBe(2);
    expect(after.total - before.total).toBe(4);
  });
});

describe("messages.service — markRead / setImportant / archiveMessage", () => {
  it("marks a message read", async () => {
    const message = await newMessage();
    const updated = await service.markRead(message.id);
    expect(updated.status).toBe("READ");
  });

  it("toggles isImportant independently of status", async () => {
    const message = await newMessage({ status: "READ" });
    const flagged = await service.setImportant(message.id, true);
    expect(flagged).toMatchObject({ status: "READ", isImportant: true });

    const unflagged = await service.setImportant(message.id, false);
    expect(unflagged).toMatchObject({ status: "READ", isImportant: false });
  });

  it("archives a message", async () => {
    const message = await newMessage();
    const archived = await service.archiveMessage(message.id);
    expect(archived.status).toBe("ARCHIVED");
  });

  it("throws NotFoundError for a message id that doesn't exist", async () => {
    await expect(service.markRead("00000000-0000-0000-0000-000000000000")).rejects.toThrow("Message not found");
  });
});

describe("messages.service — deleteMessage", () => {
  it("deletes a message", async () => {
    const message = await newMessage();
    await service.deleteMessage(message.id);
    const found = await prisma.contactMessage.findUnique({ where: { id: message.id } });
    expect(found).toBeNull();
  });
});
