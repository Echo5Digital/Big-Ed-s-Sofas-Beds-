const express = require("express");
const multer = require("multer");
const { contactMessageCreateSchema, returnMessageCreateSchema } = require("@big-eds/validation");
const { asyncHandler } = require("../middleware/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { ValidationError } = require("../lib/errors");
const cloudinary = require("../lib/cloudinary");
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

// Same memory-buffer-then-stream-to-Cloudinary approach as catalog image/
// video uploads — a customer's "Order reference" attachment on a Return
// request is either a photo of the receipt or a PDF invoice, never both
// image and video allowlists, so this is its own small multer instance.
const ALLOWED_RETURN_ATTACHMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const uploadReturnAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_RETURN_ATTACHMENT_TYPES.has(file.mimetype)) {
      return cb(new ValidationError({ attachment: "Only JPEG, PNG, WebP images or a PDF are allowed" }));
    }
    cb(null, true);
  },
});

function uploadReturnAttachmentBuffer(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "returns",
        // PDFs aren't an image/video Cloudinary resource — "raw" is required
        // for Cloudinary to accept and serve the file byte-for-byte rather
        // than trying to transform it as an image.
        resource_type: file.mimetype === "application/pdf" ? "raw" : "image",
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(file.buffer);
  });
}

// Public — the storefront's My Orders "Request Return" flow submits here
// with no session (same guest-submission convention as POST / above), via
// multipart/form-data so it can carry an optional file alongside the text
// fields. Must also be registered before router.use(requireAuth) below.
router.post(
  "/return",
  uploadReturnAttachment.single("attachment"),
  validateBody(returnMessageCreateSchema),
  asyncHandler(async (req, res) => {
    const hasReference = Boolean(req.body.returnOrderReference);
    const hasAttachment = Boolean(req.file);
    if (!hasReference && !hasAttachment) {
      throw new ValidationError({
        returnOrderReference: "Enter an order reference or attach a file",
      });
    }

    const attachment = hasAttachment ? await uploadReturnAttachmentBuffer(req.file) : null;
    const message = await messagesService.createReturnMessage({
      name: req.body.name,
      email: req.body.email,
      message: req.body.message,
      returnOrderReference: req.body.returnOrderReference || null,
      returnAttachmentUrl: attachment?.secure_url ?? null,
      returnAttachmentPublicId: attachment?.public_id ?? null,
    });
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
