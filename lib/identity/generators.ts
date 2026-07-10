const ADJECTIVES = [
  "quiet",
  "amber",
  "pale",
  "dusk",
  "soft",
  "bright",
  "still",
  "faint",
  "warm",
  "cool",
  "gentle",
  "hazy",
] as const;

const NOUNS = [
  "falcon",
  "otter",
  "lynx",
  "heron",
  "comet",
  "willow",
  "cedar",
  "sparrow",
  "badger",
  "harbor",
  "meadow",
  "canyon",
] as const;

function randomFrom<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateDisplayId(): string {
  const adjective = randomFrom(ADJECTIVES);
  const noun = randomFrom(NOUNS);
  const number = Math.floor(Math.random() * 99) + 1;
  return `${adjective}-${noun}-${number}`;
}

const SEED_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateAvatarSeed(): string {
  let seed = "";
  for (let i = 0; i < 16; i++) {
    seed += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
  }
  return seed;
}
