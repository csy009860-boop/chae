import { clsx, type ClassValue } from "clsx"
// Force sync comment
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
