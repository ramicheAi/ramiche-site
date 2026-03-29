/**
 * Shared Firestore REST URL helper for Command Center routes.
 * Use `&key=` when the path already contains `?`.
 */
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apex-athlete-73755";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export function fsUrl(path: string): string {
  const base = `${FIRESTORE_BASE}/${path}`;
  if (!API_KEY) return base;
  const sep = path.includes("?") ? "&" : "?";
  return `${base}${sep}key=${encodeURIComponent(API_KEY)}`;
}
