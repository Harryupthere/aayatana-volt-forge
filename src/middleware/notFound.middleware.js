const ApiError = require('../helpers/ApiError.helper');

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found - ${req.originalUrl}`));
};

module.exports = notFound;
