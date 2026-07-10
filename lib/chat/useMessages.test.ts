import { act } from "@testing-library/react-native";

let snapshotCallback: (snap: unknown) => void = () => {};

jest.mock("../firebase/config", () => ({ db: {} }));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  onSnapshot: jest.fn((_q, callback) => {
    snapshotCallback = callback;
    return jest.fn();
  }),
  doc: jest.fn((_db, ...rest) => ({ path: rest })),
  addDoc: jest.fn().mockResolvedValue({ id: "msg-1" }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
  increment: jest.fn((n: number) => ({ __increment: n })),
}));

import { addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useMessages } from "./useMessages";

function fakeSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

describe("useMessages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMessages.setState({ messages: [], loading: true });
  });

  it("subscribes and orders messages as received (already sorted by query)", async () => {
    const unsubscribe = useMessages.getState().subscribe("chat-1");

    await act(async () => {
      snapshotCallback(
        fakeSnap([
          { id: "m1", data: { senderId: "a", text: "hi", createdAt: { toMillis: () => 1000 } } },
          { id: "m2", data: { senderId: "b", text: "yo", createdAt: { toMillis: () => 2000 } } },
        ]),
      );
    });

    const { messages, loading } = useMessages.getState();
    expect(loading).toBe(false);
    expect(messages).toEqual([
      {
        id: "m1", senderId: "a", type: "text", text: "hi", createdAt: 1000,
        mediaUrl: undefined, mediaName: undefined, mediaSize: undefined, mediaMime: undefined,
        edited: undefined, deleted: undefined, replyTo: undefined, expiresAt: null,
      },
      {
        id: "m2", senderId: "b", type: "text", text: "yo", createdAt: 2000,
        mediaUrl: undefined, mediaName: undefined, mediaSize: undefined, mediaMime: undefined,
        edited: undefined, deleted: undefined, replyTo: undefined, expiresAt: null,
      },
    ]);
    unsubscribe();
  });

  it("sendMessage writes the message and updates the chat's lastMessage + unreadCount for the other user", async () => {
    await useMessages.getState().sendMessage("chat-1", "my-uid", "other-uid", "  hello  ");

    expect(addDoc).toHaveBeenCalledTimes(1);
    const [, payload] = (addDoc as jest.Mock).mock.calls[0];
    expect(payload).toEqual({ senderId: "my-uid", type: "text", text: "hello", createdAt: "mock-timestamp" });

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, updatePayload] = (updateDoc as jest.Mock).mock.calls[0];
    expect(updatePayload.lastMessage).toBe("hello");
    expect(updatePayload["unreadCount.other-uid"]).toEqual({ __increment: 1 });
  });

  it("sendMessage does nothing for a blank message", async () => {
    await useMessages.getState().sendMessage("chat-1", "my-uid", "other-uid", "   ");
    expect(addDoc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it("sendMediaMessage writes a media message and a preview into lastMessage", async () => {
    await useMessages.getState().sendMediaMessage("chat-1", "my-uid", "other-uid", {
      kind: "image",
      url: "https://example.com/photo.jpg",
      name: "photo.jpg",
      size: 1234,
      mime: "image/jpeg",
    });

    expect(addDoc).toHaveBeenCalledTimes(1);
    const [, payload] = (addDoc as jest.Mock).mock.calls[0];
    expect(payload).toEqual({
      senderId: "my-uid",
      type: "image",
      text: "",
      mediaUrl: "https://example.com/photo.jpg",
      mediaName: "photo.jpg",
      mediaSize: 1234,
      mediaMime: "image/jpeg",
      createdAt: "mock-timestamp",
    });

    const [, updatePayload] = (updateDoc as jest.Mock).mock.calls[0];
    expect(updatePayload.lastMessage).toBe("Photo");
  });

  it("sendMessage includes replyTo when replying", async () => {
    await useMessages.getState().sendMessage("chat-1", "my-uid", "other-uid", "sure", {
      messageId: "m1",
      senderId: "other-uid",
      preview: "original text",
    });
    const [, payload] = (addDoc as jest.Mock).mock.calls[0];
    expect(payload.replyTo).toEqual({ messageId: "m1", senderId: "other-uid", preview: "original text" });
  });

  it("editMessage updates the text and sets edited", async () => {
    await useMessages.getState().editMessage("chat-1", "m1", "  updated text  ");
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, payload] = (updateDoc as jest.Mock).mock.calls[0];
    expect(payload).toEqual({ text: "updated text", edited: true });
  });

  it("editMessage does nothing for blank text", async () => {
    await useMessages.getState().editMessage("chat-1", "m1", "   ");
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it("deleteMessage soft-deletes: clears text/media and sets deleted", async () => {
    await useMessages.getState().deleteMessage("chat-1", "m1");
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, payload] = (updateDoc as jest.Mock).mock.calls[0];
    expect(payload).toEqual({ deleted: true, text: "", mediaUrl: null, mediaName: null });
  });

  it("markRead resets the unread count and stamps lastRead for the given uid", async () => {
    await useMessages.getState().markRead("chat-1", "my-uid");
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, payload] = (updateDoc as jest.Mock).mock.calls[0];
    expect(payload["unreadCount.my-uid"]).toBe(0);
    expect(payload["lastRead.my-uid"]).toBe("mock-timestamp");
  });

  it("sendMessage includes expiresAt when the chat has disappearing messages on", async () => {
    await useMessages.getState().sendMessage("chat-1", "my-uid", "other-uid", "hi", undefined, 123456);
    const [, payload] = (addDoc as jest.Mock).mock.calls[0];
    expect(payload.expiresAt).toBe(123456);
  });

  it("sendMessage omits expiresAt when disappearing messages are off", async () => {
    await useMessages.getState().sendMessage("chat-1", "my-uid", "other-uid", "hi");
    const [, payload] = (addDoc as jest.Mock).mock.calls[0];
    expect(payload).not.toHaveProperty("expiresAt");
  });

  it("pruneExpired hard-deletes only messages past their expiresAt", async () => {
    useMessages.setState({
      messages: [
        { id: "m1", senderId: "a", type: "text", text: "old", createdAt: 1000, expiresAt: Date.now() - 1000 },
        { id: "m2", senderId: "b", type: "text", text: "future", createdAt: 2000, expiresAt: Date.now() + 100000 },
        { id: "m3", senderId: "a", type: "text", text: "no expiry", createdAt: 3000 },
      ],
      loading: false,
    });

    await useMessages.getState().pruneExpired("chat-1");

    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect((deleteDoc as jest.Mock).mock.calls[0][0]).toEqual({ path: ["chats", "chat-1", "messages", "m1"] });
  });
});
