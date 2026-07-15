const ApiError = require('../helpers/ApiError.helper');

// Usage: validateBody(['name', 'email']) as a route-level middleware.
const validateBody = (requiredFields = []) => (req, res, next) => {
  const missing = requiredFields.filter(
    (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === ''
  );

  if (missing.length) {
    return next(new ApiError(400, `Missing required field(s): ${missing.join(', ')}`));
  }

  next();
};

module.exports = validateBody;
