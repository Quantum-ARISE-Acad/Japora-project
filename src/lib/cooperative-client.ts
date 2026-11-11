/** Request body shared by the dashboard join form and its regression test. */
export function cooperativeJoinPayload(code: string) {
  return { code: String(code || "").trim().toUpperCase() };
}
