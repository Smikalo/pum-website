// api/src/server.js
const app = require("./app");

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
    console.log(`API on :${PORT}`);
});