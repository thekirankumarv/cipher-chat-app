import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useMessages } from "../lib/chat/useMessages";

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => ({ chatId: "chat-1" }),
}));

const mockSubscribe = jest.fn(() => jest.fn());
jest.mock("../lib/chat/useMessages", () => ({ useMessages: jest.fn() }));

import SearchScreen from "../app/search";

describe("SearchScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMessages as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        messages: [
          { id: "m1", senderId: "a", type: "text", text: "let's grab coffee tomorrow", createdAt: 1000 },
          { id: "m2", senderId: "b", type: "text", text: "sounds good", createdAt: 2000 },
          { id: "m3", senderId: "a", type: "text", text: "Coffee at 9?", createdAt: 3000 },
          { id: "m4", senderId: "a", type: "text", text: "deleted coffee talk", createdAt: 4000, deleted: true },
          { id: "m5", senderId: "b", type: "image", text: "", createdAt: 5000 },
        ],
        subscribe: mockSubscribe,
      }),
    );
  });

  it("shows no results before typing a query", async () => {
    const { queryByTestId, queryByText } = await render(
      <ThemeProvider>
        <SearchScreen />
      </ThemeProvider>
    );
    expect(queryByTestId("search-match-count")).toBeNull();
    expect(queryByText("let's grab coffee tomorrow")).toBeNull();
  });

  it("finds case-insensitive matches, skipping deleted and non-text messages", async () => {
    const { findByTestId, findByText, queryByText } = await render(
      <ThemeProvider>
        <SearchScreen />
      </ThemeProvider>
    );
    fireEvent.changeText(await findByTestId("search-input"), "coffee");

    expect(await findByText("2 matches")).toBeTruthy();
    expect(await findByText("let's grab coffee tomorrow")).toBeTruthy();
    expect(await findByText("Coffee at 9?")).toBeTruthy();
    expect(queryByText("deleted coffee talk")).toBeNull();
  });

  it("shows singular 'match' for exactly one result", async () => {
    const { findByTestId, findByText } = await render(
      <ThemeProvider>
        <SearchScreen />
      </ThemeProvider>
    );
    fireEvent.changeText(await findByTestId("search-input"), "sounds");
    expect(await findByText("1 match")).toBeTruthy();
  });

  it("navigates back to the chat when a result is tapped", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <SearchScreen />
      </ThemeProvider>
    );
    fireEvent.changeText(await findByTestId("search-input"), "coffee");
    fireEvent.press(await findByTestId("search-result-m1"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/chat/chat-1"));
  });
});
