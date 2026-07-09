import { colors, spacing, radii, typeScale } from "./tokens";

describe("theme tokens", () => {
  it("defines matching accent color in both themes", () => {
    expect(colors.light.accent).toBe("#5fb87a");
    expect(colors.dark.accent).toBe("#5fb87a");
  });

  it("defines the full light and dark color sets", () => {
    const keys = [
      "background",
      "surface",
      "surface2",
      "border",
      "text",
      "textSecondary",
      "textTertiary",
      "accent",
      "accentInk",
      "danger",
      "dangerSurface",
    ] as const;
    keys.forEach((key) => {
      expect(typeof colors.light[key]).toBe("string");
      expect(typeof colors.dark[key]).toBe("string");
    });
  });

  it("defines the spacing scale from the design system", () => {
    expect(spacing).toEqual({
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      xxl: 24,
      xxxl: 32,
      xxxxl: 40,
    });
  });

  it("defines the radii scale from the design system", () => {
    expect(radii).toEqual({ button: 999, card: 16, bubble: 20 });
  });

  it("defines the type scale from the design system", () => {
    expect(typeScale.screenTitle).toEqual({ fontSize: 28, fontWeight: "800" });
    expect(typeScale.header).toEqual({ fontSize: 20, fontWeight: "700" });
    expect(typeScale.chatName).toEqual({ fontSize: 17, fontWeight: "600" });
    expect(typeScale.message).toEqual({ fontSize: 16, fontWeight: "500" });
    expect(typeScale.meta).toEqual({ fontSize: 13, fontWeight: "500" });
  });
});
