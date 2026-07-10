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
const mockMarkRead = jest.fn().mockResolvedValue(undefined);
jest.mock("../lib/chat/useMessages", () => ({ useMessages: jest.fn() }));

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
});
