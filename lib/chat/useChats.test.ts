import { act } from "@testing-library/react-native";

let snapshotCallback: (snap: unknown) => void = () => {};

jest.mock("../firebase/config", () => ({ db: {} }));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  onSnapshot: jest.fn((_q, callback) => {
    snapshotCallback = callback;
    return jest.fn();
  }),
  doc: jest.fn((_db, col, id) => ({ id, col })),
  getDoc: jest.fn((ref: { id: string }) =>
    Promise.resolve({
      data: () => ({ displayId: `friend-${ref.id}`, avatarSeed: `seed-${ref.id}` }),
    }),
  ),
  updateDoc: jest.fn().mockResolvedValue(undefined),
}));

import { updateDoc } from "firebase/firestore";
import { useChats } from "./useChats";

function fakeSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

describe("useChats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useChats.setState({ chats: [], loading: true });
  });

  it("resolves the other participant and sorts by lastMessageAt desc", async () => {
    const unsubscribe = useChats.getState().subscribe("my-uid");

    await act(async () => {
      snapshotCallback(
        fakeSnap([
          {
            id: "chat-a",
            data: {
              participants: ["my-uid", "other-1"],
              lastMessage: "hi",
              lastMessageAt: { toMillis: () => 1000 },
              unreadCount: { "my-uid": 2, "other-1": 0 },
            },
          },
          {
            id: "chat-b",
            data: {
              participants: ["my-uid", "other-2"],
              lastMessage: "yo",
              lastMessageAt: { toMillis: () => 2000 },
              unreadCount: { "my-uid": 0, "other-2": 0 },
              typing: { "other-2": true },
              lastRead: { "other-2": { toMillis: () => 1500 } },
              disappearingDuration: "24h",
            },
          },
        ]),
      );
    });

    const { chats, loading } = useChats.getState();
    expect(loading).toBe(false);
    expect(chats.map((c) => c.id)).toEqual(["chat-b", "chat-a"]);
    expect(chats[0].otherDisplayId).toBe("friend-other-2");
    expect(chats[0].otherTyping).toBe(true);
    expect(chats[0].otherLastRead).toBe(1500);
    expect(chats[0].disappearingDuration).toBe("24h");
    expect(chats[1].unreadCount).toBe(2);
    expect(chats[1].otherTyping).toBe(false);
    expect(chats[1].otherLastRead).toBeNull();
    expect(chats[1].disappearingDuration).toBe("off");
    unsubscribe();
  });

  it("setTyping updates the chat doc's typing map for the given uid", async () => {
    await useChats.getState().setTyping("chat-1", "my-uid", true);
    expect(updateDoc).toHaveBeenCalledWith({ id: "chat-1", col: "chats" }, { "typing.my-uid": true });
  });

  it("setDisappearing updates the chat doc's duration", async () => {
    await useChats.getState().setDisappearing("chat-1", "7d");
    expect(updateDoc).toHaveBeenCalledWith({ id: "chat-1", col: "chats" }, { disappearingDuration: "7d" });
  });
});
