import { generateBlob } from "./generateBlob";

describe("generateBlob", () => {
  it("is deterministic for the same seed", () => {
    expect(generateBlob("quiet-falcon-42")).toEqual(generateBlob("quiet-falcon-42"));
  });

  it("produces a different path for a different seed", () => {
    const a = generateBlob("quiet-falcon-42");
    const b = generateBlob("amber-otter-7");
    expect(a.pathD).not.toEqual(b.pathD);
  });

  it("returns a valid hsl() fill color", () => {
    const { fillColor } = generateBlob("quiet-falcon-42");
    expect(fillColor).toMatch(/^hsl\(\d{1,3}, 62%, 58%\)$/);
  });

  it("returns a closed SVG path", () => {
    const { pathD } = generateBlob("quiet-falcon-42");
    expect(pathD.startsWith("M ")).toBe(true);
    expect(pathD.endsWith("Z")).toBe(true);
  });
});
