import mongoose from 'mongoose';
import { AppError } from './errors';

/**
 * Validates a string is a valid MongoDB ObjectId.
 * Accepts string | string[] (Express param type) and throws AppError if invalid.
 */
export function validateObjectId(id: string | string[], fieldName = 'id'): void {
  const value = Array.isArray(id) ? id[0] : id;
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName} — must be a valid ObjectId`);
  }
}