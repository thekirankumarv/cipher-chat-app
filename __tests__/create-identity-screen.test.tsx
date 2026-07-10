import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useIdentity } from "../lib/identity/useIdentity";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

jest.mock("../lib/identity/useIdentity", () => ({
  useIdentity: jest.fn(),
}));

import CreateIdentityScreen from "../app/create-identity";

describe("CreateIdentityScreen", () => {
  const shuffleDraftMock = jest.fn();
  const confirmIdentityMock = jest.fn().mockResolvedValue(undefined);

  const baseState = {
    draftDisplayId: "quiet-falcon-42",
    draftAvatarSeed: "seedseedseed1234",
    shuffleDraft: shuffleDraftMock,
    confirmIdentity: confirmIdentityMock,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    confirmIdentityMock.mockResolvedValue(undefined);
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector(baseState)
    );
  });

  it("shows the draft display ID", async () => {
    const { findByText } = await render(
      <ThemeProvider>
        <CreateIdentityScreen />
      </ThemeProvider>
    );
    expect(await findByText("quiet-falcon-42")).toBeTruthy();
  });

  it("calls shuffleDraft when the shuffle button is pressed", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <CreateIdentityScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("shuffle-button"));
    expect(shuffleDraftMock).toHaveBeenCalledTimes(1);
  });

  it("confirms the identity and navigates to /home when Continue is pressed", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <CreateIdentityScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("continue-button"));
    await waitFor(() => expect(confirmIdentityMock).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith("/home");
  });
});
