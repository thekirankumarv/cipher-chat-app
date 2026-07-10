import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useIdentity } from "../lib/identity/useIdentity";
import { useChats } from "../lib/chat/useChats";
import { useMessages } from "../lib/chat/useMessages";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: "chat-1" }),
}));
jest.mock("../lib/identity/useIdentity", () => ({ useIdentity: jest.fn() }));
jest.mock("../lib/chat/useChats", () => ({ useChats: jest.fn() }));

const mockSubscribe = jest.fn(() => jest.fn());
const mockChatsSubscribe = jest.fn(() => jest.fn());
const mockSendMessage = jest.fn().mockResolvedValue(undefined);
const mockSendMediaMessage = jest.fn().mockResolvedValue(undefined);
const mockEditMessage = jest.fn().mockResolvedValue(undefined);
const mockDeleteMessage = jest.fn().mockResolvedValue(undefined);
const mockMarkRead = jest.fn().mockResolvedValue(undefined);
jest.mock("../lib/chat/useMessages", () => ({ useMessages: jest.fn() }));

const mockSetStringAsync = jest.fn().mockResolvedValue(undefined);
jest.mock("expo-clipboard", () => ({ setStringAsync: (...args: any[]) => mockSetStringAsync(...args) }));

const mockPickImageOrVideo = jest.fn();
const mockPickFile = jest.fn();
jest.mock("../lib/media/pickMedia", () => ({
  pickImageOrVideo: () => mockPickImageOrVideo(),
  pickFile: () => mockPickFile(),
}));

const mockUploadMedia = jest.fn();
jest.mock("../lib/media/uploadMedia", () => ({ uploadMedia: (...args: any[]) => mockUploadMedia(...args) }));

(globalThis as any).fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve("fake-blob") });

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
          { id: "chat-1", otherUid: "other-uid", otherDisplayId: "swift-otter-42", otherAvatarSeed: "seed-1" },
        ],
        subscribe: mockChatsSubscribe,
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
        sendMediaMessage: mockSendMediaMessage,
        editMessage: mockEditMessage,
        deleteMessage: mockDeleteMessage,
        markRead: mockMarkRead,
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
      expect(mockSendMessage).toHaveBeenCalledWith("chat-1", "my-uid", "other-uid", "new message"),
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

  it("picks, uploads, and sends an image", async () => {
    mockPickImageOrVideo.mockResolvedValue({
      uri: "file://photo.jpg",
      name: "photo.jpg",
      size: 2048,
      mime: "image/jpeg",
      kind: "image",
    });
    mockUploadMedia.mockResolvedValue("https://example.com/photo.jpg");

    const { findByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("attach-media"));

    await waitFor(() =>
      expect(mockSendMediaMessage).toHaveBeenCalledWith("chat-1", "my-uid", "other-uid", {
        kind: "image",
        url: "https://example.com/photo.jpg",
        name: "photo.jpg",
        size: 2048,
        mime: "image/jpeg",
      }),
    );
  });

  it("shows an error and does not send when upload fails", async () => {
    mockPickFile.mockResolvedValue({
      uri: "file://doc.pdf",
      name: "doc.pdf",
      size: 4096,
      mime: "application/pdf",
      kind: "file",
    });
    mockUploadMedia.mockRejectedValue(new Error("network down"));

    const { findByTestId, findByText } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("attach-file"));

    expect(await findByText("Upload failed. Try again.")).toBeTruthy();
    expect(mockSendMediaMessage).not.toHaveBeenCalled();
  });

  it("does nothing when the picker is cancelled", async () => {
    mockPickImageOrVideo.mockResolvedValue(null);
    const { findByTestId } = await render(
      <ThemeProvider>
        <ChatScreen />
      </ThemeProvider>
    );
    fireEvent.press(await findByTestId("attach-media"));
    await waitFor(() => expect(mockPickImageOrVideo).toHaveBeenCalledTimes(1));
    expect(mockUploadMedia).not.toHaveBeenCalled();
    expect(mockSendMediaMessage).not.toHaveBeenCalled();
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
      expect(mockSendMessage).toHaveBeenCalledWith("chat-1", "my-uid", "other-uid", "replying now", {
        messageId: "m2",
        senderId: "my-uid",
        preview: "yo",
      }),
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
        sendMediaMessage: mockSendMediaMessage,
        editMessage: mockEditMessage,
        deleteMessage: mockDeleteMessage,
        markRead: mockMarkRead,
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
});
