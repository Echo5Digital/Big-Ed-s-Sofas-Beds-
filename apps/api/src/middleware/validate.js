const { ValidationError } = require("../lib/errors");

function validateBody(schema) {
  return function validateBodyMiddleware(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError(result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
