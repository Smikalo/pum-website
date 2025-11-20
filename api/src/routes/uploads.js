// api/src/routes/uploads.js
const express = require("express");
const {
    sendCreated,
    asyncHandler
} = require("../utils/http");
const { requireAuth } = require("../middleware/auth");
const { abs } = require("../utils/shared");
const {
    eventPhotoMiddleware,
    projectPhotoMiddleware,
    blogPhotoMiddleware
} = require("../services/uploads.service");
const { BadRequestError } = require("../errors");

const router = express.Router();

function handleUpload(middleware, subDir) {
    return [
        middleware.single("photo"),
        asyncHandler(async (req, res) => {
            if (!req.file) throw new BadRequestError("No file");
            const url = abs(`/uploads/${subDir}/${req.file.filename}`, req);
            sendCreated(res, { ok: true, url });
        })
    ];
}

router.post("/event-photo", requireAuth, ...handleUpload(eventPhotoMiddleware, "events"));
router.post("/project-photo", requireAuth, ...handleUpload(projectPhotoMiddleware, "projects"));
router.post("/blog-photo", requireAuth, ...handleUpload(blogPhotoMiddleware, "blogs"));

module.exports = router;