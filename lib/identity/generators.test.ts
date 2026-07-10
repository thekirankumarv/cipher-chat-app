import { generateDisplayId, generateAvatarSeed } from "./generators";

describe("generateDisplayId", () => {
  it("returns an adjective-noun-number string", () => {
    const id = generateDisplayId();
    expect(id).toMatch(/^[a-z]+-[a-z]+-\d{1,2}$/);
  });

  it("can produce different values across calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateDisplayId()));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("generateAvatarSeed", () => {
  it("returns a 16-character lowercase alphanumeric string", () => {
    const seed = generateAvatarSeed();
    expect(seed).toMatch(/^[a-z0-9]{16}$/);
  });

  it("can produce different values across calls", () => {
    const seeds = new Set(Array.from({ length: 20 }, () => generateAvatarSeed()));
    expect(seeds.size).toBeGreaterThan(1);
  });
});
