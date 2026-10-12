export function minutesToTenths(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError(`Invalid minutes: ${minutes}`);
  }
  return Math.round(minutes / 6) / 10;
}