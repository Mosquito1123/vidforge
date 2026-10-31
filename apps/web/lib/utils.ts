import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function toRMB(cents: number, rate = 7.2): string {
  return `¥${((cents / 100) * rate).toFixed(2)}`;
}
