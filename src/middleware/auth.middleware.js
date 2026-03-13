const jwt = require('jsonwebtoken');
const AppError = require('../errors');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Missing or invalid Authorization header', 401));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.userId };
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

module.exports = authenticate;
