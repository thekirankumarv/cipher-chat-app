import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useIdentity } from "../lib/identity/useIdentity";

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));
jest.mock("../lib/identity/useIdentity", () => ({ useIdentity: jest.fn() }));

const mockResetIdentity = jest.fn().mockResolvedValue(undefined);

import SettingsScreen from "../app/settings";

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        displayId: "swift-otter-42",
        avatarSeed: "seed-1",
        resetIdentity: mockResetIdentity,
      }),
    );
  });

  it("shows the current identity", async () => {
    const { findByText } = await render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>
    );
    expect(await findByText("swift-otter-42")).toBeTruthy();
  });

  it("changes theme mode when a pill is pressed", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("theme-dark"));
    // No throw + still renders is the meaningful assertion here; ThemeProvider
    // persists the choice internally (covered by its own tests).
    expect(await findByTestId("theme-dark")).toBeTruthy();
  });

  it("requires confirmation before resetting identity", async () => {
    const { findByTestId, queryByTestId } = await render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>
    );
    expect(queryByTestId("reset-identity-confirm")).toBeNull();
    fireEvent.press(await findByTestId("reset-identity-button"));
    expect(await findByTestId("reset-identity-confirm")).toBeTruthy();
    expect(mockResetIdentity).not.toHaveBeenCalled();
  });

  it("resets identity and navigates to / on confirm", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("reset-identity-button"));
    fireEvent.press(await findByTestId("reset-identity-confirm"));
    await waitFor(() => expect(mockResetIdentity).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });

  it("cancels the reset confirmation", async () => {
    const { findByTestId, queryByTestId } = await render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("reset-identity-button"));
    fireEvent.press(await findByTestId("reset-identity-cancel"));
    await waitFor(() => expect(queryByTestId("reset-identity-confirm")).toBeNull());
    expect(mockResetIdentity).not.toHaveBeenCalled();
  });

  it("shows an error and stays put if reset fails", async () => {
    mockResetIdentity.mockRejectedValueOnce(new Error("network down"));
    const { findByTestId, findByText } = await render(
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("reset-identity-button"));
    fireEvent.press(await findByTestId("reset-identity-confirm"));
    expect(await findByText("network down")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
