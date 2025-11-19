// api/src/routes/uploads.js
const express = require("express");
const {
    sendCreated,
    sendBadRequest
} = require("../utils/http");
const { requireAuth } = require("../middleware/auth");
const { abs } = require("../utils/shared");
const {
    eventPhotoMiddleware,
    projectPhotoMiddleware,
    blogPhotoMiddleware
} = require("../services/uploads.service");

const router = express.Router();

function handleUpload(middleware, subDir) {
    return (req, res, next) => {
        return middleware.single("photo")(req, res, (err) => {
            if (err) return next(err);
            if (!req.file) return sendBadRequest(res, "No file");
            const url = abs(`/uploads/${subDir}/${req.file.filename}`, req);
            sendCreated(res, { ok: true, url });
        });
    };
}

router.post("/event-photo", requireAuth, handleUpload(eventPhotoMiddleware, "events"));
router.post("/project-photo", requireAuth, handleUpload(projectPhotoMiddleware, "projects"));
router.post("/blog-photo", requireAuth, handleUpload(blogPhotoMiddleware, "blogs"));

module.exports = router;