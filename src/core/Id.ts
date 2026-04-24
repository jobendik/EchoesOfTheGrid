/** Monotonic id generator. Scoped by prefix (unit, card, combat, etc.). */
let counter = 0;

export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}`;
}

/** Reset the counter. Only used by tests to keep ids deterministic. */
export function __resetIds(): void {
  counter = 0;
}
