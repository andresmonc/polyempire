/**
 * A simple seeded pseudo-random number generator.
 * This is useful for procedural generation where you want the same
 * sequence of random numbers for a given seed.
 *
 * This implementation uses the Mulberry32 algorithm, which is simple and fast.
 *
 * TODO: This is a placeholder for future map generation features.
 */
export class SeededRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Returns a pseudo-random float between 0 (inclusive) and 1 (exclusive).
   */
  public nextFloat(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a pseudo-random integer between min (inclusive) and max (inclusive).
   * @param min - The minimum possible integer value.
   * @param max - The maximum possible integer value.
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }
}
