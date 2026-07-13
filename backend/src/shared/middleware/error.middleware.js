export function errorMiddleware(err, req, res, next) {
  console.error('[Global Error Interceptor]', err);

  const status = err.status || 500;
  const message = err.message || 'An unexpected error occurred on the server.';
  
  // Clean JSON response
  res.status(status).json({
    success: false,
    status,
    message,
    errors: err.errors || null,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
}
