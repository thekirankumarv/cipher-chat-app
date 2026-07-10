import { act } from "@testing-library/react-native";

jest.mock("../firebase/config", () => ({ auth: { currentUser: { uid: "my-uid" } }, db: {} }));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db, col, id) => ({ id, col })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(() => ({})),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
  Timestamp: { now: jest.fn(() => ({ toMillis: () => 1000 })) },
}));

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, addDoc } from "firebase/firestore";
import { auth } from "../firebase/config";
import { useInvite } from "./useInvite";

describe("useInvite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as { currentUser: { uid: string } | null }).currentUser = { uid: "my-uid" };
  });

  it("createInvite writes an invites doc and returns the code", async () => {
    (setDoc as jest.Mock).mockResolvedValue(undefined);
    let code = "";
    await act(async () => {
      code = await useInvite.getState().createInvite();
    });
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/);
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = (setDoc as jest.Mock).mock.calls[0];
    expect(ref.col).toBe("invites");
    expect(ref.id).toBe(code);
    expect(payload.createdBy).toBe("my-uid");
    expect(payload.used).toBe(false);
  });

  it("redeemInvite throws not-found when the invite doc doesn't exist", async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    await expect(useInvite.getState().redeemInvite("AAA-BBBB-CC")).rejects.toThrow("not-found");
  });

  it("redeemInvite throws used when the invite is already used", async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ createdBy: "other-uid", used: true, expiresAt: { toMillis: () => Date.now() + 100000 } }),
    });
    await expect(useInvite.getState().redeemInvite("AAA-BBBB-CC")).rejects.toThrow("used");
  });

  it("redeemInvite throws expired when past expiresAt", async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ createdBy: "other-uid", used: false, expiresAt: { toMillis: () => Date.now() - 1000 } }),
    });
    await expect(useInvite.getState().redeemInvite("AAA-BBBB-CC")).rejects.toThrow("expired");
  });

  it("redeemInvite throws self when the code was created by the same uid", async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ createdBy: "my-uid", used: false, expiresAt: { toMillis: () => Date.now() + 100000 } }),
    });
    await expect(useInvite.getState().redeemInvite("AAA-BBBB-CC")).rejects.toThrow("self");
  });

  it("redeemInvite creates a chat, marks the invite used, and returns the chatId", async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ createdBy: "other-uid", used: false, expiresAt: { toMillis: () => Date.now() + 100000 } }),
    });
    (addDoc as jest.Mock).mockResolvedValue({ id: "chat-123" });
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    let chatId = "";
    await act(async () => {
      chatId = await useInvite.getState().redeemInvite("AAA-BBBB-CC");
    });

    expect(chatId).toBe("chat-123");
    expect(addDoc).toHaveBeenCalledTimes(1);
    const [, payload] = (addDoc as jest.Mock).mock.calls[0];
    expect(payload.participants.sort()).toEqual(["my-uid", "other-uid"].sort());
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [, updatePayload] = (updateDoc as jest.Mock).mock.calls[0];
    expect(updatePayload.used).toBe(true);
  });

  it("waits for onAuthStateChanged when currentUser isn't resolved yet on mount", async () => {
    (auth as { currentUser: { uid: string } | null }).currentUser = null;
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback({ uid: "late-uid" });
      return jest.fn();
    });
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    let code = "";
    await act(async () => {
      code = await useInvite.getState().createInvite();
    });

    expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
    const [, payload] = (setDoc as jest.Mock).mock.calls[0];
    expect(payload.createdBy).toBe("late-uid");
    expect(code).toBeTruthy();
  });
});
