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
    blogPhotoMiddleware,
    processImageUpload
} = require("../services/uploads.service");
const { BadRequestError } = require("../errors");

const router = express.Router();

/**
 * Helper to wire up route -> middleware -> service -> response.
 */
function handleUpload(middleware, subDir) {
    return [
        middleware.single("photo"),
        asyncHandler(async (req, res) => {
            if (!req.file) {
                throw new BadRequestError("No file");
            }
            // Delegate to centralized service logic
            // Service will re-validate file type/size and rules
            const result = await processImageUpload({ file: req.file, subDir });
            const url = abs(result.url, req);
            sendCreated(res, { ok: true, url });
        })
    ];
}

// POST /api/uploads/event-photo
router.post(
    "/event-photo",
    requireAuth,
    ...handleUpload(eventPhotoMiddleware, "events")
);

// POST /api/uploads/project-photo
router.post(
    "/project-photo",
    requireAuth,
    ...handleUpload(projectPhotoMiddleware, "projects")
);

// POST /api/uploads/blog-photo
router.post(
    "/blog-photo",
    requireAuth,
    ...handleUpload(blogPhotoMiddleware, "blogs")
);

module.exports = router;