/** Format a Date as YYYY-MM-DDTHH:MM:SS in the server's local timezone. */
export function formatLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Convert an unknown DB value to a local-timezone ISO-like string. */
export function toLocalIso(v: unknown): string {
  if (v instanceof Date) return formatLocal(v);
  if (typeof v === "string") return formatLocal(new Date(v));
  return String(v);
}
