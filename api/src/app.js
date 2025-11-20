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

// Domain routers
const membersRouter = require("./routes/members");
const projectsRouter = require("./routes/projects");
const eventsRouter = require("./routes/events");
const blogRouter = require("./routes/blog");
const uploadsRouter = require("./routes/uploads");
const marketingRouter = require("./routes/marketing");

const {
    sendOk,
} = require("./utils/http");
const {
    upsertStringList,
    UPLOAD_ROOT,
    WEB_ORIGIN
} = require("./utils/shared");
const { AppError } = require("./errors");

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
        const dbOk = await prisma.$queryRaw`SELECT 1`;
        sendOk(res, { ok: true, service: "api", db: !!dbOk });
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

/* ------------------------------ Error handler ------------------------------ */
app.use((err, req, res, _next) => {
    if (res.headersSent) return;

    if (err instanceof multer.MulterError) {
        let error = "Upload error";
        if (err.code === "LIMIT_FILE_SIZE") {
            error = "File too large";
        } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
            error = "Unsupported file type";
        }
        return res.status(400).json({ ok: false, error });
    }

    if (err instanceof AppError) {
        const status = err.statusCode || 500;
        const payload = {
            ok: false,
            error: err.message,
        };
        if (err.details !== undefined) {
            payload.details = err.details;
        }
        return res.status(status).json(payload);
    }

    const message = err?.message || "Server error";

    // Fallback for validation errors not yet typed
    if (
        message.includes("Invalid input") ||
        message.includes("validation") ||
        message.includes("ZodError")
    ) {
        return res.status(400).json({ ok: false, error: message });
    }

    // Internal server error fallback
    const status = 500;
    const msg = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : message;

    // Log error server-side
    console.error(err);

    return res.status(status).json({ ok: false, error: msg });
});

module.exports = app;