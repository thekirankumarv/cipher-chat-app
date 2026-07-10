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
}));

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
            },
          },
        ]),
      );
    });

    const { chats, loading } = useChats.getState();
    expect(loading).toBe(false);
    expect(chats.map((c) => c.id)).toEqual(["chat-b", "chat-a"]);
    expect(chats[0].otherDisplayId).toBe("friend-other-2");
    expect(chats[1].unreadCount).toBe(2);
    unsubscribe();
  });
});
