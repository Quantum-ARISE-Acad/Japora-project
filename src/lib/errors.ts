/** Read ordinary and Clerk-style errors without trusting an untyped payload. */
export function errorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const detail = error as { message?: unknown; errors?: unknown };
  if (Array.isArray(detail.errors)) {
    const first = detail.errors[0] as { message?: unknown } | undefined;
    if (typeof first?.message === "string" && first.message) return first.message;
  }
  return typeof detail.message === "string" && detail.message ? detail.message : fallback;
}
