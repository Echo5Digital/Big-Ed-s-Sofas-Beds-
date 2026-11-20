const { SquareClient, SquareEnvironment } = require("square");
const { env } = require("./env");

const square = new SquareClient({
  token: env.squareAccessToken,
  environment: env.squareEnvironment === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
});

module.exports = { square };
