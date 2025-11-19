const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const {
    sendCreated,
    sendBadRequest
} = require("../utils/http");
const { requireAuth } = require("../middleware/auth");
const {
    abs,
    eventsDir,
    projectsDir,
    blogsDir
} = require("../utils/shared");

const router = express.Router();

const eventPhotoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, eventsDir),
    filename: (_req, file, cb) => {
        const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp|gif)$/i.test(ext) ? ext : "bin";
        const name = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, name);
    },
});

const uploadEventPhoto = multer({
    storage: eventPhotoStorage,
    limits: { fileSize: 8 * 1024 * 1024, files: 12 },
    fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) cb(null, true);
        else cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "photo"));
    },
});

router.post("/event-photo", requireAuth, async (req, res, next) => {
    return uploadEventPhoto.single("photo")(req, res, (err) => {
        if (err) return next(err);
        if (!req.file) return sendBadRequest(res, "No file");
        const url = abs(`/uploads/events/${req.file.filename}`, req);
        sendCreated(res, { ok: true, url });
    });
});

const projectPhotoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, projectsDir),
    filename: (_req, file, cb) => {
        const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp|gif)$/i.test(ext) ? ext : "bin";
        const name = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, name);
    },
});

const uploadProjectPhoto = multer({
    storage: projectPhotoStorage,
    limits: { fileSize: 8 * 1024 * 1024, files: 12 },
    fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) cb(null, true);
        else cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "photo"));
    },
});

router.post("/project-photo", requireAuth, async (req, res, next) => {
    return uploadProjectPhoto.single("photo")(req, res, (err) => {
        if (err) return next(err);
        if (!req.file) return sendBadRequest(res, "No file");
        const url = abs(`/uploads/projects/${req.file.filename}`, req);
        sendCreated(res, { ok: true, url });
    });
});

const blogStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, blogsDir),
    filename: (_req, file, cb) => {
        const orig = file.originalname || "unnamed";
        const ext = (orig.split(".").pop() || "bin").toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp|gif)$/.test(ext) ? ext : "bin";
        const name = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, name);
    },
});

const uploadBlogPhoto = multer({
    storage: blogStorage,
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const noRealFile = !file.originalname || file.mimetype === "application/octet-stream";
        if (noRealFile) return cb(null, false);
        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) return cb(null, true);
        const err = new Error("Unsupported file type");
        err.code = "UNSUPPORTED_FILE_TYPE";
        return cb(err);
    },
});

router.post("/blog-photo", requireAuth, async (req, res) => {
    uploadBlogPhoto.single("photo")(req, res, (err) => {
        if (err) {
            if (err.code === "UNSUPPORTED_FILE_TYPE") return sendBadRequest(res, "Unsupported file type");
            return sendBadRequest(res, "Upload failed");
        }
        if (!req.file) return sendBadRequest(res, "No file uploaded");
        const url = abs(`/uploads/blogs/${req.file.filename}`, req);
        sendCreated(res, { ok: true, url });
    });
});

module.exports = router;