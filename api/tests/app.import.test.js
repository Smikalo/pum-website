const app = require("../src/app");
const { run, assert } = require("./_lib");

run("App module exports Express app", async () => {
    assert(typeof app === 'function', "app should be a function");
    assert(typeof app.use === 'function', "app should have .use()");
});