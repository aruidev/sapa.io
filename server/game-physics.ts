/**
 * Determines if player a can consume player b based on their positions and sizes. A player can consume another if the distance between them is less than or equal to the difference in their sizes (with a small margin for fairness).
 * @param a Player A
 * @param b Player B
 * @returns boolean indicating if player a can consume player b
 */
export function canConsume(
  a: { x: number; y: number; size: number },
  b: { x: number; y: number; size: number },
): boolean {
  const distance = distanceBetween(a.x, a.y, b.x, b.y);
  return distance <= Math.max(0, a.size - b.size * 0.3);
}

/**
 * Calculates the new size of a player after consuming another entity (player or food). The new size is determined by treating the sizes as areas (proportional to the square of the radius) and summing them, then taking the square root to get the new radius.
 * @param currentSize number - The current size of the player
 * @param eatenSize number - The size of the entity being consumed
 * @returns number - The new size of the player after consuming the entity
 */
export function growRadius(currentSize: number, eatenSize: number): number {
  return Math.sqrt(currentSize ** 2 + eatenSize ** 2);
}

/**
 * Calculates the distance between two points (ax, ay) and (bx, by) using the Euclidean distance formula.
 * @param ax number - The x-coordinate of the first point.
 * @param ay number - The y-coordinate of the first point.
 * @param bx number - The x-coordinate of the second point.
 * @param by number - The y-coordinate of the second point.
 * @returns number - The distance between the two points.
 */
export function distanceBetween(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Clamps a value between a minimum and maximum range. If the value is less than the minimum, it returns the minimum. If the value is greater than the maximum, it returns the maximum. Otherwise, it returns the original value.
 * @param value number - The value to be clamped.
 * @param min number - The minimum allowed value.
 * @param max number - The maximum allowed value.
 * @returns 
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Generates a random number between the specified minimum and maximum values. The result is a floating-point number that can include decimals.
 * @param min number - The minimum value (inclusive) for the random number.
 * @param max number - The maximum value (exclusive) for the random number.
 * @returns number - A random number between min (inclusive) and max (exclusive).
 */
export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Picks a random element from an array.
 * @param values readonly T[] - The array of values to choose from.
 * @returns T - The randomly selected value.
 */
export function pickRandom<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)] as T;
}