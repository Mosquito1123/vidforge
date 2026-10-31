/**
 * Phone number helpers shared by the phone/SMS/risk modules.
 *
 * Numbers are normalised to E.164 (`+<country><national number>`) before they
 * are stored or compared, so `138 0013 8000`, `+8613800138000` and
 * `008613800138000` all collapse to the same identity.
 */

const CN_MOBILE = /^1[3-9]\d{9}$/;
const E164 = /^\+[1-9]\d{5,14}$/;

export function normalizePhone(input: string): string {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return "";

  const compact = trimmed.replace(/[\s\-().]/g, "");
  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/\D/g, "")}`;
  }
  if (compact.startsWith("00")) {
    return `+${compact.slice(2).replace(/\D/g, "")}`;
  }
  if (CN_MOBILE.test(compact)) {
    return `+86${compact}`;
  }
  if (/^861[3-9]\d{9}$/.test(compact)) {
    return `+${compact}`;
  }
  const digits = compact.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

export function isValidPhone(phone: string): boolean {
  return E164.test(phone);
}

/** `+8613800138000` -> `+86138****8000` */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 6) return `+${"*".repeat(Math.max(digits.length - 2, 0))}${digits.slice(-2)}`;
  const country = phone.startsWith("+") ? phone.slice(1, 3) : "";
  const national = phone.startsWith("+") ? digits.slice(2) : digits;
  if (national.length <= 6) return `+${country}${"*".repeat(national.length)}`;
  const head = national.slice(0, 3);
  const tail = national.slice(-4);
  return `+${country}${head}${"*".repeat(Math.max(national.length - 7, 2))}${tail}`;
}

/** Mask an IP for display/audit purposes (`203.0.113.42` -> `203.0.113.x`). */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const first = ip.split(",")[0]?.trim();
  if (!first) return null;
  if (first.includes(":")) {
    const parts = first.split(":");
    return `${parts.slice(0, 2).join(":")}:****`;
  }
  const parts = first.split(".");
  if (parts.length !== 4) return first;
  return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
}

/** Normalise the `x-forwarded-for` style headers into a single address. */
export function extractIp(req: {
  ip?: string;
  headers?: Record<string, unknown>;
  socket?: { remoteAddress?: string };
}): string | null {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(",")[0]?.trim() || null;
  }
  return req?.ip ?? req?.socket?.remoteAddress ?? null;
}
