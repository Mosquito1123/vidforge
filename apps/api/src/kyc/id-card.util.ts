/**
 * Mainland China resident ID card (18-digit) validation and derivation.
 *
 * The full number is validated with the GB 11643-1999 check digit, then only
 * derived, non-identifying attributes and masked strings are allowed to leave
 * this module.
 */

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CHECK_CHARS = '10X98765432';

export type IdGender = 'male' | 'female' | 'unknown';

export interface ParsedIdCard {
  valid: boolean;
  reason?: string;
  birthDate: string | null;
  gender: IdGender;
  age: number | null;
  isAdult: boolean;
  regionCode: string | null;
  maskedIdNumber: string | null;
}

export function maskIdNumber(idNumber: string): string {
  const value = String(idNumber ?? '').trim().toUpperCase();
  if (value.length <= 7) return '*'.repeat(value.length);
  return `${value.slice(0, 3)}${'*'.repeat(Math.max(value.length - 7, 3))}${value.slice(-4)}`;
}

/** Keep the first character; mask the rest. `张三` -> `张*`, `John Doe` -> `J*******`. */
export function maskRealName(realName: string): string {
  const value = String(realName ?? '').trim();
  if (!value) return '';
  if (value.length === 1) return '*';
  return `${value[0]}${'*'.repeat(value.length - 1)}`;
}

export function isValidRealName(realName: string): boolean {
  const value = String(realName ?? '').trim();
  if (value.length < 2 || value.length > 50) return false;
  // Chinese names (including the middle dot used by some ethnic-minority names)
  if (/^[\u4e00-\u9fa5][\u4e00-\u9fa5·]{1,29}$/.test(value)) return true;
  // Latin names as printed on passports / foreign IDs
  return /^[A-Za-z][A-Za-z .'-]{1,49}$/.test(value);
}

function computeAge(birthDate: Date, now = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

export function parseIdCard(raw: string): ParsedIdCard {
  const value = String(raw ?? '').trim().toUpperCase();
  const empty: ParsedIdCard = {
    valid: false,
    birthDate: null,
    gender: 'unknown',
    age: null,
    isAdult: false,
    regionCode: null,
    maskedIdNumber: null,
  };

  if (!value) return { ...empty, reason: 'ID number is required' };
  if (!/^\d{17}[\dX]$/.test(value)) {
    return { ...empty, reason: 'ID number must be 18 digits (last digit may be X)' };
  }

  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += Number(value[i]) * WEIGHTS[i];
  }
  if (CHECK_CHARS[sum % 11] !== value[17]) {
    return { ...empty, reason: 'ID number checksum is invalid' };
  }

  const regionCode = value.slice(0, 6);
  if (regionCode === '000000') {
    return { ...empty, reason: 'ID number region code is invalid' };
  }

  const year = Number(value.slice(6, 10));
  const month = Number(value.slice(10, 12));
  const day = Number(value.slice(12, 14));
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) {
    return { ...empty, reason: 'ID number birth date is invalid' };
  }
  const now = new Date();
  if (year < 1900 || birthDate.getTime() > now.getTime()) {
    return { ...empty, reason: 'ID number birth date is out of range' };
  }

  const age = computeAge(birthDate, now);
  const gender: IdGender = Number(value[16]) % 2 === 1 ? 'male' : 'female';

  return {
    valid: true,
    birthDate: `${value.slice(6, 10)}-${value.slice(10, 12)}-${value.slice(12, 14)}`,
    gender,
    age,
    isAdult: age >= 18,
    regionCode,
    maskedIdNumber: maskIdNumber(value),
  };
}
