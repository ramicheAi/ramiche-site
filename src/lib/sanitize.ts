/**
 * Client-side input sanitization for METTLE.
 * Strips dangerous HTML/script content from user inputs.
 * Applied to: quest descriptions, journal entries, feedback, coach notes.
 */

/** Strip HTML tags and script content from a string */
export function sanitize(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

/** Sanitize and limit length */
export function sanitizeWithLimit(input: string, maxLength: number): string {
  return sanitize(input).slice(0, maxLength);
}

/** Validate email format */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
