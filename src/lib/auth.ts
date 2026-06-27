import { DEFAULT_USER_ID } from "@/lib/config";

/**
 * Resolves the owning user for a request.
 *
 * The app is single-tenant today, so every row is owned by DEFAULT_USER_ID.
 * When authentication is added, this is the single place to swap in a real
 * session lookup; the API routes already scope all reads/writes by its return.
 */
export function getUserId(_request: Request): string {
  return DEFAULT_USER_ID;
}
