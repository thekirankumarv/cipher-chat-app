import { act } from "@testing-library/react-native";

let snapshotCallback: (snap: unknown) => void = () => {};

jest.mock("../firebase/config", () => ({ db: {} }));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db, col, id) => ({ id, col })),
  onSnapshot: jest.fn((_ref, callback) => {
    snapshotCallback = callback;
    return jest.fn();
  }),
}));

import { useUserPresence, formatLastSeen } from "./useUserPresence";

describe("useUserPresence", () => {
  beforeEach(() => {
    useUserPresence.setState({ byUid: {} });
  });

  it("subscribes to a user's doc and stores online/lastSeen", async () => {
    const unsubscribe = useUserPresence.getState().subscribe("other-uid");
    await act(async () => {
      snapshotCallback({ data: () => ({ online: true, lastSeen: { toMillis: () => 1000 } }) });
    });
    expect(useUserPresence.getState().byUid["other-uid"]).toEqual({ online: true, lastSeen: 1000 });
    unsubscribe();
  });

  it("defaults to offline/null when the doc has no presence fields", async () => {
    useUserPresence.getState().subscribe("other-uid");
    await act(async () => {
      snapshotCallback({ data: () => undefined });
    });
    expect(useUserPresence.getState().byUid["other-uid"]).toEqual({ online: false, lastSeen: null });
  });
});

describe("formatLastSeen", () => {
  it("shows Offline when there's no lastSeen", () => {
    expect(formatLastSeen(null)).toBe("Offline");
  });

  it("shows just now for under a minute", () => {
    expect(formatLastSeen(Date.now() - 5000)).toBe("Last seen just now");
  });

  it("shows minutes ago", () => {
    expect(formatLastSeen(Date.now() - 5 * 60000)).toBe("Last seen 5m ago");
  });

  it("shows hours ago", () => {
    expect(formatLastSeen(Date.now() - 3 * 3600000)).toBe("Last seen 3h ago");
  });

  it("shows days ago", () => {
    expect(formatLastSeen(Date.now() - 2 * 86400000)).toBe("Last seen 2d ago");
  });
});
