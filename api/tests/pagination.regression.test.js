const { run, get, assert } = require("./_lib");

async function expectPaging(path, expectedMax) {
    {
        const { res, body } = await get(path);
        assert(res.status === 200, `defaults: ${path} -> ${res.status}`);
        assert(typeof body.page === "number" && body.page >= 1, "default page missing/invalid");
    }
}

run("Members pagination", async () => { await expectPaging("/api/members", 1000); });
run("Projects pagination", async () => { await expectPaging("/api/projects", 1000); });
run("Blogs pagination", async () => { await expectPaging("/api/blogs", 1000); });
run("Events pagination", async () => { await expectPaging("/api/events", 1000); });