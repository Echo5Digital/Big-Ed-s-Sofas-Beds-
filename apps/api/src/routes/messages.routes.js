const express = require("express");
const { contactMessageCreateSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const messagesService = require("../services/messages.service");

const router = express.Router();

// Public — the storefront's /contact form submits here with no session.
// Must be registered before router.use(requireAuth) below.
router.post(
  "/",
  validateBody(contactMessageCreateSchema),
  asyncHandler(async (req, res) => {
    const message = await messagesService.createMessage(req.body);
    res.status(201).json({ message });
  })
);

router.use(requireAuth);

router.get(
  "/",
  requirePermission("messages:read"),
  asyncHandler(async (req, res) => {
    res.json({ messages: await messagesService.listMessages() });
  })
);

router.get(
  "/counts",
  requirePermission("messages:read"),
  asyncHandler(async (req, res) => {
    res.json(await messagesService.countUnreadAndImportant());
  })
);

router.patch(
  "/:id/read",
  requirePermission("messages:read"),
  asyncHandler(async (req, res) => {
    res.json({ message: await messagesService.markRead(req.params.id) });
  })
);

router.patch(
  "/:id/important",
  requirePermission("messages:write"),
  asyncHandler(async (req, res) => {
    res.json({ message: await messagesService.setImportant(req.params.id, Boolean(req.body?.isImportant)) });
  })
);

router.patch(
  "/:id/archive",
  requirePermission("messages:write"),
  asyncHandler(async (req, res) => {
    res.json({ message: await messagesService.archiveMessage(req.params.id) });
  })
);

router.delete(
  "/:id",
  requirePermission("messages:write"),
  asyncHandler(async (req, res) => {
    await messagesService.deleteMessage(req.params.id);
    res.json({ success: true });
  })
);

module.exports = router;
