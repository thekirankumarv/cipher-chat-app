export type ColorTokens = {
  background: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentInk: string;
  danger: string;
  dangerSurface: string;
};

export const colors: { light: ColorTokens; dark: ColorTokens } = {
  light: {
    background: "#ffffff",
    surface: "#eceef2",
    surface2: "#f5f6f8",
    border: "#dde1e7",
    text: "#15171c",
    textSecondary: "#666666",
    textTertiary: "#999999",
    accent: "#5fb87a",
    accentInk: "#ffffff",
    danger: "#ff8a80",
    dangerSurface: "#fdecea",
  },
  dark: {
    background: "#1c1e24",
    surface: "#292c33",
    surface2: "#33363e",
    border: "#3d4048",
    text: "#f5f6f8",
    textSecondary: "#a7abb4",
    textTertiary: "#777b85",
    accent: "#5fb87a",
    accentInk: "#0d1f14",
    danger: "#5c2b2e",
    dangerSurface: "#2a1215",
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
} as const;

export const radii = {
  button: 999,
  card: 16,
  bubble: 20,
} as const;

export const typeScale = {
  screenTitle: { fontSize: 28, fontWeight: "800" },
  header: { fontSize: 20, fontWeight: "700" },
  chatName: { fontSize: 17, fontWeight: "600" },
  message: { fontSize: 16, fontWeight: "500" },
  meta: { fontSize: 13, fontWeight: "500" },
} as const;
