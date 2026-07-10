import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useIdentity } from "../lib/identity/useIdentity";
import { useChats } from "../lib/chat/useChats";
import { useMessages } from "../lib/chat/useMessages";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => ({ id: "chat-1" }),
}));
jest.mock("../lib/identity/useIdentity", () => ({ useIdentity: jest.fn() }));
jest.mock("../lib/chat/useChats", () => ({ useChats: jest.fn() }));

const mockSubscribe = jest.fn(() => jest.fn());
const mockChatsSubscribe = jest.fn(() => jest.fn());
const mockSendMessage = jest.fn().mockResolvedValue(undefined);
const mockEditMessage = jest.fn().mockResolvedValue(undefined);
const mockDeleteMessage = jest.fn().mockResolvedValue(undefined);
const mockMarkRead = jest.fn().mockResolvedValue(undefined);
jest.mock("../lib/chat/useMessages", () => ({ useMessages: jest.fn() }));

const mockSetStringAsync = jest.fn().mockResolvedValue(undefined);
jest.mock("expo-clipboard", () => ({ setStringAsync: (...args: any[]) => mockSetStringAsync(...args) }));

const mockSetTyping = jest.fn().mockResolvedValue(undefined);
const mockSetDisappearing = jest.fn().mockResolvedValue(undefined);
const mockPruneExpired = jest.fn().mockResolvedValue(undefined);
const mockPresenceSubscribe = jest.fn(() => jest.fn());
jest.mock("../lib/presence/useUserPresence", () => ({
  useUserPresence: jest.fn((selector: any) => selector({ byUid: {}, subscribe: mockPresenceSubscribe })),
  formatLastSeen: () => "Offline",
}));

import ChatScreen from "../app/chat/[id]";

describe("ChatScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ uid: "my-uid" }),
    );
    (useChats as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        chats: [
          {
            id: "chat-1", otherUid: "other-uid", otherDisplayId: "swift-otter-42", otherAvatarSeed: "seed-1",
            otherTyping: false, otherLastRead: null, disappearingDuration: "off",
          },
        ],
        subscribe: mockChatsSubscribe,
        setTyping: mockSetTyping,
        setDisappearing: mockSetDisappearing,
      }),
    );
    (useMessages as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        messages: [
          { id: "m1", senderId: "other-uid", type: "text", text: "hey", createdAt: 1000 },
          { id: "m2", senderId: "my-uid", type: "text", text: "yo", createdAt: 2000 },
        ],
        subscribe: mockSubscribe,
        sendMessage: mockSendMessage,
        editMessage: mockEditMessage,
        deleteMessage: mockDeleteMessage,
        markRead: mockMarkRead,
        pruneExpired: mockPruneExpired,
      }),
    );
  });

  it("renders messages and the other participant's name", async () => {
    const { findByText, findByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    expect(await findByText("swift-otter-42")).toBeTruthy();
    expect(await findByText("hey")).toBeTruthy();
    expect(await findByText("yo")).toBeTruthy();
    expect(await findByTestId("message-m1")).toBeTruthy();
    expect(mockSubscribe).toHaveBeenCalledWith("chat-1");
    expect(mockChatsSubscribe).toHaveBeenCalledWith("my-uid");
    expect(mockMarkRead).toHaveBeenCalledWith("chat-1", "my-uid");
  });

  it("redirects to Home when the messages subscription errors (e.g. a stale deep link to an inaccessible chat)", async () => {
    (useMessages as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        messages: [],
        error: "not-found",
        subscribe: mockSubscribe,
        sendMessage: mockSendMessage,
        editMessage: mockEditMessage,
        deleteMessage: mockDeleteMessage,
        markRead: mockMarkRead,
        pruneExpired: mockPruneExpired,
      }),
    );
    await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/home"));
  });

  it("sends a message and clears the input", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    const input = await findByTestId("message-input");
    fireEvent.changeText(input, "new message");
    fireEvent.press(await findByTestId("send-button"));
    await waitFor(() =>
      expect(mockSendMessage).toHaveBeenCalledWith(
        "chat-1", "my-uid", "other-uid", "new message", undefined, undefined,
      ),
    );
    expect(input.props.value).toBe("");
  });

  it("does not send a blank message", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("send-button"));
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("shows reply/copy/edit/delete actions for my own message and replies to it", async () => {
    const { findByTestId, findByText } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("message-m2"));
    expect(await findByTestId("action-reply-m2")).toBeTruthy();
    expect(await findByTestId("action-copy-m2")).toBeTruthy();
    expect(await findByTestId("action-edit-m2")).toBeTruthy();
    expect(await findByTestId("action-delete-m2")).toBeTruthy();

    fireEvent.press(await findByTestId("action-reply-m2"));
    expect(await findByText("Replying to: yo")).toBeTruthy();

    const input = await findByTestId("message-input");
    fireEvent.changeText(input, "replying now");
    fireEvent.press(await findByTestId("send-button"));
    await waitFor(() =>
      expect(mockSendMessage).toHaveBeenCalledWith(
        "chat-1", "my-uid", "other-uid", "replying now",
        { messageId: "m2", senderId: "my-uid", preview: "yo" },
        undefined,
      ),
    );
  });

  it("only shows reply/copy for the other person's message, not edit/delete", async () => {
    const { findByTestId, queryByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("message-m1"));
    expect(await findByTestId("action-reply-m1")).toBeTruthy();
    expect(await findByTestId("action-copy-m1")).toBeTruthy();
    expect(queryByTestId("action-edit-m1")).toBeNull();
    expect(queryByTestId("action-delete-m1")).toBeNull();
  });

  it("copies message text to the clipboard", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("message-m1"));
    fireEvent.press(await findByTestId("action-copy-m1"));
    await waitFor(() => expect(mockSetStringAsync).toHaveBeenCalledWith("hey"));
  });

  it("edits my own message", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("message-m2"));
    fireEvent.press(await findByTestId("action-edit-m2"));
    const input = await findByTestId("message-input");
    expect(input.props.value).toBe("yo");

    fireEvent.changeText(input, "yo edited");
    fireEvent.press(await findByTestId("send-button"));
    await waitFor(() => expect(mockEditMessage).toHaveBeenCalledWith("chat-1", "m2", "yo edited"));
  });

  it("deletes my own message", async () => {
    const { findByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("message-m2"));
    fireEvent.press(await findByTestId("action-delete-m2"));
    await waitFor(() => expect(mockDeleteMessage).toHaveBeenCalledWith("chat-1", "m2"));
  });

  it("renders a deleted message with no actions", async () => {
    (useMessages as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        messages: [
          { id: "m3", senderId: "my-uid", type: "text", text: "", deleted: true, createdAt: 3000 },
        ],
        subscribe: mockSubscribe,
        sendMessage: mockSendMessage,
        editMessage: mockEditMessage,
        deleteMessage: mockDeleteMessage,
        markRead: mockMarkRead,
        pruneExpired: mockPruneExpired,
      }),
    );
    const { findByText, queryByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    expect(await findByText("This message was deleted")).toBeTruthy();
    expect(queryByTestId("action-delete-m3")).toBeNull();
  });

  it("shows typing… in the header when the other participant is typing", async () => {
    (useChats as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        chats: [
          {
            id: "chat-1", otherUid: "other-uid", otherDisplayId: "swift-otter-42", otherAvatarSeed: "seed-1",
            otherTyping: true, otherLastRead: null, disappearingDuration: "off",
          },
        ],
        subscribe: mockChatsSubscribe,
        setTyping: mockSetTyping,
        setDisappearing: mockSetDisappearing,
      }),
    );
    const { findByText } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    expect(await findByText("typing…")).toBeTruthy();
  });

  it("marks typing true on input change and clears it on send", async () => {
    jest.useFakeTimers();
    const { findByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    const input = await findByTestId("message-input");
    fireEvent.changeText(input, "hi");
    expect(mockSetTyping).toHaveBeenCalledWith("chat-1", "my-uid", true);

    fireEvent.press(await findByTestId("send-button"));
    await waitFor(() => expect(mockSetTyping).toHaveBeenCalledWith("chat-1", "my-uid", false));
    jest.useRealTimers();
  });

  it("shows Read on my last message once the other participant's lastRead catches up", async () => {
    (useChats as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        chats: [
          {
            id: "chat-1", otherUid: "other-uid", otherDisplayId: "swift-otter-42", otherAvatarSeed: "seed-1",
            otherTyping: false, otherLastRead: 5000, disappearingDuration: "off",
          },
        ],
        subscribe: mockChatsSubscribe,
        setTyping: mockSetTyping,
        setDisappearing: mockSetDisappearing,
      }),
    );
    const { findByTestId, findByText } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    expect(await findByTestId("read-status-m2")).toBeTruthy();
    expect(await findByText("Read")).toBeTruthy();
  });

  it("shows the current disappearing setting and lets you change it", async () => {
    const { findByTestId, findByText } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    expect(await findByText("Disappearing: Off")).toBeTruthy();

    fireEvent.press(await findByTestId("disappearing-toggle"));
    fireEvent.press(await findByTestId("disappearing-24h"));
    expect(mockSetDisappearing).toHaveBeenCalledWith("chat-1", "24h");
  });

  it("sends with an expiresAt timestamp when disappearing messages are on", async () => {
    (useChats as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        chats: [
          {
            id: "chat-1", otherUid: "other-uid", otherDisplayId: "swift-otter-42", otherAvatarSeed: "seed-1",
            otherTyping: false, otherLastRead: null, disappearingDuration: "24h",
          },
        ],
        subscribe: mockChatsSubscribe,
        setTyping: mockSetTyping,
        setDisappearing: mockSetDisappearing,
      }),
    );
    const before = Date.now();
    const { findByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    fireEvent.changeText(await findByTestId("message-input"), "vanishing text");
    fireEvent.press(await findByTestId("send-button"));

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());
    const [, , , , , expiresAt] = (mockSendMessage as jest.Mock).mock.calls[0];
    expect(expiresAt).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000);
    expect(expiresAt).toBeLessThan(before + 24 * 60 * 60 * 1000 + 5000);
  });

  it("hides a message once its expiresAt has passed", async () => {
    (useMessages as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        messages: [
          { id: "m1", senderId: "other-uid", type: "text", text: "long gone", createdAt: 1000, expiresAt: Date.now() - 1000 },
          { id: "m2", senderId: "my-uid", type: "text", text: "still here", createdAt: 2000, expiresAt: Date.now() + 100000 },
        ],
        subscribe: mockSubscribe,
        sendMessage: mockSendMessage,
        editMessage: mockEditMessage,
        deleteMessage: mockDeleteMessage,
        markRead: mockMarkRead,
        pruneExpired: mockPruneExpired,
      }),
    );
    const { findByText, queryByText } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    expect(await findByText("still here")).toBeTruthy();
    expect(queryByText("long gone")).toBeNull();
  });
});
