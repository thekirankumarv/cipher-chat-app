import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useIdentity } from "../lib/identity/useIdentity";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const bootstrap = useIdentity((s) => s.bootstrap);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Runs once here (root layout is always mounted, unlike index.tsx which
  // only mounts for that one route) so a hard reload on /home, /chat/[id],
  // etc. still restores the anonymous session instead of leaving uid null.
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
