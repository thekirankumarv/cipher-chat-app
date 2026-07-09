import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, ColorTokens } from "./tokens";

export type ThemeModePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  mode: ThemeModePreference;
  resolvedScheme: "light" | "dark";
  colors: ColorTokens;
  setMode: (mode: ThemeModePreference) => void;
};

const STORAGE_KEY = "cipher.themeMode";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeModePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = (next: ThemeModePreference) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const resolvedScheme: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedScheme,
      colors: colors[resolvedScheme],
      setMode,
    }),
    [mode, resolvedScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
