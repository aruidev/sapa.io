// utils.ts
// Auxiliary functions for the game, such as clamping values and converting screen coordinates to world coordinates

/**
 * Function to generate a unique ID for players and food items, using a simple random string approach.
 * @param value optional prefix for the ID, defaulting to "id"
 * @param min the minimum random number to generate, defaulting to 1000
 * @param max the maximum random number to generate, defaulting to 9999
 * @returns a unique string ID combining the prefix and a random number
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Function to convert screen coordinates (e.g., from mouse events) to world coordinates based on the current camera position and world bounds, ensuring the resulting coordinates are clamped within the world limits.
 * @param screenX the x-coordinate from the screen (e.g., mouse event)
 * @param screenY the y-coordinate from the screen (e.g., mouse event)
 * @param camera the current camera position with x and y properties
 * @param bounds the world bounds with width and height properties to ensure the resulting coordinates are within limits
 * @returns an object containing the x and y world coordinates corresponding to the given screen coordinates
 */
export function screenToWorld(screenX: number, screenY: number, camera: { x: number; y: number }, bounds: { width: number; height: number }) {
  return {
    x: clamp(screenX + camera.x, 0, bounds.width),
    y: clamp(screenY + camera.y, 0, bounds.height),
  };
}
