// api/src/index.js
// This file delegates to server.js for startup.
// app.js contains the Express configuration.

require("./server");

// Re-exporting utils for potential consumers
const { upsertStringList } = require("./utils/shared");
module.exports = { upsertStringList };