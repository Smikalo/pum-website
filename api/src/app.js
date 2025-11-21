// api/src/app.js
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const { prisma } = require("./db");
const { authRouter } = require("./auth");
const { accountRouter } = require("./account");
const logger = require("./logger");

// Domain routers
const membersRouter = require("./routes/members");
const projectsRouter = require("./routes/projects");
const eventsRouter = require("./routes/events");
const blogRouter = require("./routes/blog");
const uploadsRouter = require("./routes/uploads");
const marketingRouter = require("./routes/marketing");

const {
    sendOk,
    sendNotFound, // Import this
} = require("./utils/http");
const {
    upsertStringList,
    UPLOAD_ROOT,
    WEB_ORIGIN
} = require("./utils/shared");
const { AppError, NotFoundError } = require("./errors");
const { NODE_ENV } = require("./config");

const app = express();

/* -------------------------------- CORS -------------------------------- */
const corsOptions = {
    origin: WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization"],
    optionsSuccessStatus: 204,
};

app.use((req, _res, next) => {
    next();
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ---------------- Proxy + middleware ---------------- */
app.set("trust proxy", 1);
app.use(express.json({ limit: "5mb" }));
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false,
    }),
);

const limiter = rateLimit({ windowMs: 60_000, max: 300 });
app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const durationMs = Date.now() - start;
        const userId = req.user?.id || req.userId || null;

        logger.info('HTTP request', {
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            userId,
            durationMs
        });
    });

    next();
});

/* ------------------------ Static uploads ------------------------ */
app.use(
    "/uploads",
    (req, res, next) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.removeHeader("X-Frame-Options");
        res.setHeader(
            "Content-Security-Policy",
            `frame-ancestors 'self' ${WEB_ORIGIN}`,
        );
        next();
    },
    express.static(UPLOAD_ROOT, { maxAge: "1h", etag: true }),
);

/* ------------------------------ Health ------------------------------ */
app.get("/healthz", async (_req, res) => {
    try {
        // const dbOk = await prisma.$queryRaw`SELECT 1`; // Optional db check
        sendOk(res, { ok: true, service: "api", db: true });
    } catch (e) {
        res.status(500).json({
            ok: false,
            service: "api",
            db: false,
            error: String(e),
        });
    }
});

/* ------------------------------ Routers ------------------------------ */
app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);

app.use("/api/members", membersRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/blog", blogRouter);
app.use("/api/blogs", blogRouter);

app.use("/api/uploads", uploadsRouter);
app.use("/api", marketingRouter);

/* ------------------------------ 404 Handler ------------------------------ */
// Catch-all for undefined routes to ensure JSON response
app.use((req, res, next) => {
    next(new NotFoundError("Not found"));
});

/* ------------------------------ Error handler ------------------------------ */
app.use((err, req, res, _next) => {
    if (res.headersSent) return;

    let statusCode = 500;
    let payload = { ok: false, error: "Server error" };

    if (err instanceof multer.MulterError) {
        statusCode = 400;
        let error = "Upload error";
        if (err.code === "LIMIT_FILE_SIZE") {
            error = "File too large";
        } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
            error = "Unsupported file type";
        }
        payload = { ok: false, error };
    } else if (err instanceof AppError) {
        statusCode = err.statusCode || 500;
        payload = { ok: false, error: err.message };
        if (err.details !== undefined) {
            payload.details = err.details;
        }
    } else {
        const message = err?.message || "Server error";
        if (
            message.includes("Invalid input") ||
            message.includes("validation") ||
            message.includes("ZodError")
        ) {
            statusCode = 400;
            payload = { ok: false, error: message };
        } else {
            statusCode = 500;
            const msg = NODE_ENV === 'production'
                ? 'Internal server error'
                : message;
            payload = { ok: false, error: msg };
        }
    }

    const userId = req.user?.id || req.userId || null;

    // Log the error server-side (skip 404 logging if preferred, but keeping for now)
    if (statusCode !== 404) {
        logger.error('Unhandled error', {
            message: err.message,
            name: err.name,
            statusCode,
            path: req.originalUrl || req.url,
            method: req.method,
            userId
        });
    }

    return res.status(statusCode).json(payload);
});

module.exports = app;