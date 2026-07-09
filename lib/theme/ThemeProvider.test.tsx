import React from "react";
import { Text } from "react-native";
import { render, act, fireEvent } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider, useTheme } from "./ThemeProvider";

jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  default: jest.fn(() => "light"),
}));

function Probe() {
  const { mode, resolvedScheme, colors, setMode } = useTheme();
  return (
    <>
      <Text testID="mode">{mode}</Text>
      <Text testID="scheme">{resolvedScheme}</Text>
      <Text testID="bg">{colors.background}</Text>
      <Text testID="toggle" onPress={() => setMode("dark")}>
        toggle
      </Text>
    </>
  );
}

describe("ThemeProvider", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("defaults to system mode resolved against the device scheme", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect((await findByTestId("mode")).props.children).toBe("system");
    expect((await findByTestId("scheme")).props.children).toBe("light");
  });

  it("lets setMode override the resolved scheme and persists it", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    const toggle = await findByTestId("toggle");
    await act(async () => {
      fireEvent.press(toggle);
    });
    expect((await findByTestId("scheme")).props.children).toBe("dark");
    expect(await AsyncStorage.getItem("cipher.themeMode")).toBe("dark");
  });
});
