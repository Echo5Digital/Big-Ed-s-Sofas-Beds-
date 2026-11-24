const request = require("supertest");
const { prisma } = require("@big-eds/database");
const { createApp } = require("../app");

// HTTP-level coverage for the storefront's public, unauthenticated message
// endpoints (POST /messages, POST /messages/return) — no session required,
// same convention as orders.status.routes.test.js's auth coverage, but there
// is no auth here to exercise since both routes are deliberately public (see
// the "Public" comments in messages.routes.js). Runs against the real dev
// database (no Prisma mock layer in this repo). The attachment-upload branch
// of /messages/return (Cloudinary) is intentionally not exercised here, same
// as this repo's existing catalog.routes.test.js leaves the image/video
// upload routes untested — it would require a real Cloudinary round trip.
describe("messages.routes — POST /messages/return", () => {
  const app = createApp();
  const emailPrefix = `messages-return-route-test-${Date.now()}`;
  const createdIds = [];

  afterAll(async () => {
    await prisma.contactMessage.deleteMany({ where: { id: { in: createdIds } } });
  });

  it("creates a return request message when an order reference is typed (no file)", async () => {
    const res = await request(app)
      .post("/api/messages/return")
      .field("name", "Jane Doe")
      .field("email", `${emailPrefix}-ok@example.com`)
      .field("message", "The sofa arrived with a torn cushion.")
      .field("returnOrderReference", "BE-10042");

    expect(res.status).toBe(201);
    expect(res.body.message).toMatchObject({
      isReturnRequest: true,
      returnOrderReference: "BE-10042",
      returnAttachmentUrl: null,
      status: "NEW",
    });
    createdIds.push(res.body.message.id);
  });

  it("rejects when neither an order reference nor a file is provided", async () => {
    const res = await request(app)
      .post("/api/messages/return")
      .field("name", "Jane Doe")
      .field("email", `${emailPrefix}-missing-ref@example.com`)
      .field("message", "Please process my return.");

    expect(res.status).toBe(422);
  });

  it("rejects an invalid email the same way the plain /messages route does", async () => {
    const res = await request(app)
      .post("/api/messages/return")
      .field("name", "Jane Doe")
      .field("email", "not-an-email")
      .field("message", "Please process my return.")
      .field("returnOrderReference", "BE-10042");

    expect(res.status).toBe(422);
  });

  it("does not require auth (public route, same as POST /messages)", async () => {
    const res = await request(app)
      .post("/api/messages/return")
      .field("name", "Jane Doe")
      .field("email", `${emailPrefix}-noauth@example.com`)
      .field("message", "No session cookie sent with this request.")
      .field("returnOrderReference", "BE-20001");

    expect(res.status).toBe(201);
    createdIds.push(res.body.message.id);
  });
});

describe("messages.routes — POST /messages (unchanged by the Return feature)", () => {
  const app = createApp();
  const emailPrefix = `messages-plain-route-test-${Date.now()}`;
  const createdIds = [];

  afterAll(async () => {
    await prisma.contactMessage.deleteMany({ where: { id: { in: createdIds } } });
  });

  it("still creates a plain, non-return message exactly as before", async () => {
    const res = await request(app)
      .post("/api/messages")
      .send({ name: "Jane Doe", email: `${emailPrefix}@example.com`, message: "Do you deliver to Austin?" });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatchObject({ isReturnRequest: false, returnOrderReference: null });
    createdIds.push(res.body.message.id);
  });
});
