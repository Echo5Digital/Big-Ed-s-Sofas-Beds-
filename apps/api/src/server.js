const { createApp } = require("./app");
const { env } = require("./lib/env");

const app = createApp();

app.listen(env.port, () => {
  console.log(`Big Ed's API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
