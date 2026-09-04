import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui's class combiner — required by components added via its CLI. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
