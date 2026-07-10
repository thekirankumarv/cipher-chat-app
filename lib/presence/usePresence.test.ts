import { renderHook, waitFor } from "@testing-library/react-native";

jest.mock("../firebase/config", () => ({ db: {} }));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db, col, id) => ({ id, col })),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

import { updateDoc } from "firebase/firestore";
import { usePresence } from "./usePresence";

describe("usePresence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks the user online on mount and offline on unmount", async () => {
    const { unmount } = await renderHook(() => usePresence("my-uid"));

    await waitFor(() =>
      expect(updateDoc).toHaveBeenCalledWith({ id: "my-uid", col: "users" }, {
        online: true,
        lastSeen: "mock-timestamp",
      }),
    );

    (updateDoc as jest.Mock).mockClear();
    unmount();

    await waitFor(() =>
      expect(updateDoc).toHaveBeenCalledWith({ id: "my-uid", col: "users" }, {
        online: false,
        lastSeen: "mock-timestamp",
      }),
    );
  });

  it("does nothing when uid is null", async () => {
    await renderHook(() => usePresence(null));
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it("registers a periodic heartbeat while mounted", async () => {
    const setIntervalSpy = jest.spyOn(globalThis, "setInterval");
    await renderHook(() => usePresence("my-uid"));
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 25000);
    setIntervalSpy.mockRestore();
  });
});
