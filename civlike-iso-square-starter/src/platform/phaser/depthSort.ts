/**
 * Performs a stable sort on an array of game objects based on their y-coordinate,
 * with the x-coordinate used as a tie-breaker. This is essential for correct
 * depth sorting in an isometric view, ensuring objects that are "lower" on the
 * screen are drawn on top of objects that are "higher".
 *
 * A stable sort is crucial to prevent "z-fighting" or flickering between two
 * sprites that have the same y-coordinate in a given frame. An unstable sort
 * might swap their order randomly, causing them to flicker back and forth.
 *
 * This function sorts the array in-place.
 *
 * @param arr - The array of objects to sort. Each object must have `y` and `x` properties.
 */
export function stableSort(
  arr: { y: number; x: number; [key: string]: any }[],
): void {
  arr.sort((a, b) => {
    const dy = a.y - b.y;
    if (dy !== 0) {
      return dy;
    }
    // If y is the same, use x as a tie-breaker. This adds stability.
    return a.x - b.x;
  });
}
