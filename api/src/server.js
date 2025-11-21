// api/src/server.js
const app = require("./app");
const { PORT, NODE_ENV } = require("./config");
const logger = require("./logger");

app.listen(PORT, () => {
    logger.info('Server started', {
        port: PORT,
        env: NODE_ENV
    });
});