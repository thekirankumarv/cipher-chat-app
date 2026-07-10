import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useIdentity } from "../lib/identity/useIdentity";
import { useChats } from "../lib/chat/useChats";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../lib/identity/useIdentity", () => ({ useIdentity: jest.fn() }));

const mockSubscribe = jest.fn(() => jest.fn());
jest.mock("../lib/chat/useChats", () => ({ useChats: jest.fn() }));

import HomeScreen from "../app/home";

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ uid: "my-uid" }),
    );
  });

  function mockChatsState(state: { chats: unknown[]; loading: boolean }) {
    (useChats as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ ...state, subscribe: mockSubscribe }),
    );
  }

  it("shows a loading state before the first chat snapshot resolves", async () => {
    mockChatsState({ chats: [], loading: true });
    const { findByTestId, queryByText } = await render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>
    );
    expect(await findByTestId("home-loading")).toBeTruthy();
    expect(queryByText("No connections yet")).toBeNull();
  });

  it("shows the empty state when there are no chats", async () => {
    mockChatsState({ chats: [], loading: false });
    const { findByText } = await render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>
    );
    expect(await findByText("No connections yet")).toBeTruthy();
    expect(mockSubscribe).toHaveBeenCalledWith("my-uid");
  });

  it("renders a chat row with last message and unread badge", async () => {
    mockChatsState({
      chats: [
        {
          id: "chat-1",
          otherUid: "other-uid",
          otherDisplayId: "swift-otter-42",
          otherAvatarSeed: "seed-1",
          lastMessage: "hey there",
          lastMessageAt: Date.now(),
          unreadCount: 3,
        },
      ],
      loading: false,
    });
    const { findByText, findByTestId } = await render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>
    );
    expect(await findByText("swift-otter-42")).toBeTruthy();
    expect(await findByText("hey there")).toBeTruthy();
    expect(await findByText("3")).toBeTruthy();
    fireEvent.press(await findByTestId("chat-row-chat-1"));
    expect(mockPush).toHaveBeenCalledWith("/chat/chat-1");
  });
});
