export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

/** Produces an unbiased integer from 1 through the chosen number of sides. */
export function rollDie(sides: number) {
  if (!Number.isInteger(sides) || sides < 2) throw new RangeError("A die must have at least two sides.");
  if (!globalThis.crypto?.getRandomValues) return Math.floor(Math.random() * sides) + 1;
  const range = 0x100000000;
  const ceiling = Math.floor(range / sides) * sides;
  const buffer = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(buffer); while (buffer[0] >= ceiling);
  return buffer[0] % sides + 1;
}
