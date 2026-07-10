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
  serverTimestamp: jest.fn(() => "mock-timestamp"),
  increment: jest.fn((n: number) => ({ __increment: n })),
}));

import { addDoc, updateDoc } from "firebase/firestore";
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
      { id: "m1", senderId: "a", type: "text", text: "hi", createdAt: 1000, mediaUrl: undefined, mediaName: undefined, mediaSize: undefined, mediaMime: undefined },
      { id: "m2", senderId: "b", type: "text", text: "yo", createdAt: 2000, mediaUrl: undefined, mediaName: undefined, mediaSize: undefined, mediaMime: undefined },
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

  it("markRead resets the unread count for the given uid", async () => {
    await useMessages.getState().markRead("chat-1", "my-uid");
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, payload] = (updateDoc as jest.Mock).mock.calls[0];
    expect(payload["unreadCount.my-uid"]).toBe(0);
  });
});
