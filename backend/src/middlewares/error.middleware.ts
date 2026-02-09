import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        message: 'A record with this unique field already exists',
        error: err.message
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        message: 'Record not found',
        error: err.message
      });
      return;
    }

    res.status(400).json({
      message: 'Database error',
      error: err.message
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      message: 'Validation error',
      error: err.message
    });
    return;
  }

  // Default error
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};