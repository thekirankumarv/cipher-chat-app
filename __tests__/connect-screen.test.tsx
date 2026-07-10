import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useInvite } from "../lib/invite/useInvite";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("../lib/invite/useInvite", () => ({ useInvite: jest.fn() }));

import ConnectScreen from "../app/connect";

describe("ConnectScreen", () => {
  const mockCreateInvite = jest.fn().mockResolvedValue("ABC-2H9K-7Q");
  const mockRedeemInvite = jest.fn().mockResolvedValue("chat-123");

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateInvite.mockResolvedValue("ABC-2H9K-7Q");
    (useInvite as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ createInvite: mockCreateInvite, redeemInvite: mockRedeemInvite })
    );
  });

  it("shows My Code tab by default and generates a code on mount", async () => {
    const { findByText } = await render(
      <ThemeProvider>
        <ConnectScreen />
      </ThemeProvider>
    );
    expect(await findByText("ABC-2H9K-7Q")).toBeTruthy();
    expect(mockCreateInvite).toHaveBeenCalledTimes(1);
  });

  it("switches to Enter Code tab and redeems a typed code", async () => {
    const { findByTestId, findByText } = await render(
      <ThemeProvider>
        <ConnectScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("tab-enter-code"));
    const input = await findByTestId("enter-code-input");
    fireEvent.changeText(input, "XYZ-1234-AB");
    fireEvent.press(await findByTestId("enter-code-submit"));
    await waitFor(() => expect(mockRedeemInvite).toHaveBeenCalledWith("XYZ-1234-AB"));
    expect(mockReplace).toHaveBeenCalledWith("/chat/chat-123");
  });

  it("shows a friendly error when the code is not found", async () => {
    mockRedeemInvite.mockRejectedValue(new Error("not-found"));
    const { findByTestId, findByText } = await render(
      <ThemeProvider>
        <ConnectScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("tab-enter-code"));
    fireEvent.changeText(await findByTestId("enter-code-input"), "XYZ-1234-AB");
    fireEvent.press(await findByTestId("enter-code-submit"));
    expect(await findByText("That code doesn't exist. Check it and try again.")).toBeTruthy();
  });
});
