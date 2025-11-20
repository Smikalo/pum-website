// api/src/server.js
const app = require("./app");
const { PORT } = require("./config");

app.listen(PORT, () => {
    console.log(`API on :${PORT}`);
});