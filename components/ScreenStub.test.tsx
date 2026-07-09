import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { ScreenStub } from "./ScreenStub";

describe("ScreenStub", () => {
  it("renders the given title", async () => {
    const { findByText } = await render(
      <ThemeProvider>
        <ScreenStub title="Welcome / Splash" />
      </ThemeProvider>
    );
    expect(await findByText("Welcome / Splash")).toBeTruthy();
  });
});
