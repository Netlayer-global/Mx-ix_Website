import { Request, Response, NextFunction } from 'express';
import config from '../config/environment';

interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorMiddleware = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Mongoose duplicate key error
  if (err.code === '11000') {
    statusCode = 409;
    message = 'Duplicate entry. This record already exists.';
  }

  // JWT errors are handled in auth middleware

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(config.isDevelopment && { stack: err.stack }),
  });
};

// Not found handler
export const notFoundMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

export default { errorMiddleware, notFoundMiddleware };
