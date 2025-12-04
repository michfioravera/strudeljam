// src/utils/id.ts
// Utility for generating unique IDs

/**
 * Generates a unique ID using crypto.randomUUID when available,
 * with a fallback to timestamp + random string
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${randomPart}`;
}

/**
 * Generates a short ID (useful for display purposes)
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 11);
}