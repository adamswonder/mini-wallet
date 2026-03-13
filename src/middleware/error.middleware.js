function errorMiddleware(err, req, res, next) {
  // (400, 404, 422)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Unexpected errors
  console.error('Unexpected error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
}

module.exports = errorMiddleware;
