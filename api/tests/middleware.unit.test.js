// api/tests/middleware.unit.test.js
const { requireAuth, requireAdminOrModerator, requireAdminOrModeratorOrCreator } = require("../src/middleware/auth");
const { assert, run } = require("./_lib");

// Mock express objects
function mockRes() {
    const res = {};
    res.statusCode = 200; // default
    res.body = null;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
}

run("requireAuth missing header", async () => {
    const req = { get: () => null };
    const res = mockRes();
    let nextCalled = false;
    await requireAuth(req, res, () => { nextCalled = true; });
    assert(!nextCalled, "next() should not be called");
    assert(res.statusCode === 401, "Status should be 401");
    assert(res.body.error === "Missing access token", "Error message mismatch");
});

run("requireAdminOrModerator success (admin)", () => {
    const req = { user: { roles: [{ role: "ADMIN" }] } };
    const res = mockRes();
    let nextCalled = false;
    requireAdminOrModerator(req, res, () => { nextCalled = true; });
    assert(nextCalled, "next() should be called for admin");
});

run("requireAdminOrModerator success (moderator)", () => {
    const req = { user: { roles: [{ role: "MODERATOR" }] } };
    const res = mockRes();
    let nextCalled = false;
    requireAdminOrModerator(req, res, () => { nextCalled = true; });
    assert(nextCalled, "next() should be called for moderator");
});

run("requireAdminOrModerator failure (member)", () => {
    const req = { user: { roles: [{ role: "MEMBER" }] } };
    const res = mockRes();
    let nextCalled = false;
    requireAdminOrModerator(req, res, () => { nextCalled = true; });
    assert(!nextCalled, "next() should NOT be called for member");
    assert(res.statusCode === 403, "Status should be 403");
});

run("requireAdminOrModeratorOrCreator passes for admin", async () => {
    const req = { user: { roles: [{ role: "ADMIN" }] } };
    const res = mockRes();
    let nextCalled = false;
    const mw = requireAdminOrModeratorOrCreator(async () => false);
    await mw(req, res, () => { nextCalled = true; });
    assert(nextCalled, "next() should be called for admin even if not creator");
});

run("requireAdminOrModeratorOrCreator passes for creator", async () => {
    const req = { user: { roles: [{ role: "MEMBER" }] } };
    const res = mockRes();
    let nextCalled = false;
    const mw = requireAdminOrModeratorOrCreator(async () => true);
    await mw(req, res, () => { nextCalled = true; });
    assert(nextCalled, "next() should be called for creator");
});

run("requireAdminOrModeratorOrCreator fails for non-creator member", async () => {
    const req = { user: { roles: [{ role: "MEMBER" }] } };
    const res = mockRes();
    let nextCalled = false;
    const mw = requireAdminOrModeratorOrCreator(async () => false);
    await mw(req, res, () => { nextCalled = true; });
    assert(!nextCalled, "next() should NOT be called");
    assert(res.statusCode === 403, "Status should be 403");
});