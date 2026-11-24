const { SquareClient, SquareEnvironment } = require("square");
const { env } = require("./env");

const square = new SquareClient({
  token: env.squareAccessToken,
  environment: env.squareEnvironment === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  // Without this the SDK has no caller-facing default, so a slow/hanging
  // Square response could hold open the request it was called from (e.g.
  // POST /checkout/:id/pay) indefinitely. 30s matches this repo's own test
  // timeout convention (vitest.config.mjs) as a reasonable outer bound for a
  // single synchronous payment call.
  timeoutInSeconds: 30,
});

module.exports = { square };
