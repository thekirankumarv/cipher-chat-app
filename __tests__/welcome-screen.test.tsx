import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useIdentity } from "../lib/identity/useIdentity";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require("react-native");
    return <Text testID="redirect">{href}</Text>;
  },
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("../lib/identity/useIdentity", () => ({
  useIdentity: jest.fn(),
}));

import WelcomeScreen from "../app/index";

describe("WelcomeScreen", () => {
  const bootstrapMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a loading state while bootstrapping", async () => {
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ status: "bootstrapping", bootstrap: bootstrapMock })
    );
    const { findByText } = await render(
      <ThemeProvider>
        <WelcomeScreen />
      </ThemeProvider>
    );
    expect(await findByText("Loading…")).toBeTruthy();
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
  });

  it("shows Get Started and navigates to create-identity when pressed", async () => {
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ status: "needs-identity", bootstrap: bootstrapMock })
    );
    const { findByTestId } = await render(
      <ThemeProvider>
        <WelcomeScreen />
      </ThemeProvider>
    );
    const button = await findByTestId("get-started-button");
    fireEvent.press(button);
    expect(mockPush).toHaveBeenCalledWith("/create-identity");
  });

  it("redirects to /home when the identity is ready", async () => {
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ status: "ready", bootstrap: bootstrapMock })
    );
    const { findByTestId } = await render(
      <ThemeProvider>
        <WelcomeScreen />
      </ThemeProvider>
    );
    expect(await findByTestId("redirect")).toBeTruthy();
  });

  it("shows the error and retries bootstrap when Try again is pressed", async () => {
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        status: "bootstrapping",
        error: "Couldn't connect. Check your connection and try again.",
        bootstrap: bootstrapMock,
      })
    );
    const { findByText, findByTestId } = await render(
      <ThemeProvider>
        <WelcomeScreen />
      </ThemeProvider>
    );
    expect(
      await findByText("Couldn't connect. Check your connection and try again.")
    ).toBeTruthy();
    fireEvent.press(await findByTestId("retry-button"));
    expect(bootstrapMock).toHaveBeenCalledTimes(2);
  });
});
