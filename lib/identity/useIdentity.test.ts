import { act } from "@testing-library/react-native";

jest.mock("../firebase/config", () => ({
  auth: { currentUser: null },
  db: {},
}));

jest.mock("firebase/auth", () => ({
  signInAnonymously: jest.fn(),
  signOut: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => ({ id: "mock-doc-ref" })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "mock-timestamp"),
}));

import { signInAnonymously, signOut } from "firebase/auth";
import { getDoc, setDoc } from "firebase/firestore";
import { useIdentity } from "./useIdentity";

describe("useIdentity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useIdentity.setState({
      status: "bootstrapping",
      uid: null,
      displayId: null,
      avatarSeed: null,
      draftDisplayId: "quiet-falcon-42",
      draftAvatarSeed: "seedseedseed1234",
      error: null,
    });
  });

  it("shuffleDraft replaces both draft values", () => {
    const before = useIdentity.getState();
    act(() => {
      useIdentity.getState().shuffleDraft();
    });
    const after = useIdentity.getState();
    expect(after.draftDisplayId).not.toEqual(before.draftDisplayId);
    expect(after.draftAvatarSeed).not.toEqual(before.draftAvatarSeed);
  });

  it("bootstrap signs in anonymously and sets needs-identity when no user doc exists", async () => {
    (signInAnonymously as jest.Mock).mockResolvedValue({ user: { uid: "uid-1" } });
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    await act(async () => {
      await useIdentity.getState().bootstrap();
    });

    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(useIdentity.getState().status).toBe("needs-identity");
    expect(useIdentity.getState().uid).toBe("uid-1");
  });

  it("bootstrap loads an existing identity and sets ready when a user doc exists", async () => {
    (signInAnonymously as jest.Mock).mockResolvedValue({ user: { uid: "uid-2" } });
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ displayId: "amber-otter-7", avatarSeed: "existingseed0001" }),
    });

    await act(async () => {
      await useIdentity.getState().bootstrap();
    });

    const state = useIdentity.getState();
    expect(state.status).toBe("ready");
    expect(state.displayId).toBe("amber-otter-7");
    expect(state.avatarSeed).toBe("existingseed0001");
  });

  it("confirmIdentity writes the draft identity to Firestore and sets ready", async () => {
    useIdentity.setState({ uid: "uid-3" });

    await act(async () => {
      await useIdentity.getState().confirmIdentity();
    });

    expect(setDoc).toHaveBeenCalledTimes(1);
    const [, payload] = (setDoc as jest.Mock).mock.calls[0];
    expect(payload.displayId).toBe("quiet-falcon-42");
    expect(payload.avatarSeed).toBe("seedseedseed1234");
    const state = useIdentity.getState();
    expect(state.status).toBe("ready");
    expect(state.displayId).toBe("quiet-falcon-42");
  });

  it("confirmIdentity throws if called before a uid exists", async () => {
    useIdentity.setState({ uid: null });
    await expect(useIdentity.getState().confirmIdentity()).rejects.toThrow(
      "confirmIdentity called before bootstrap resolved a uid"
    );
  });

  it("bootstrap catches a signInAnonymously failure and sets an error instead of throwing", async () => {
    (signInAnonymously as jest.Mock).mockRejectedValue(new Error("network unreachable"));

    await act(async () => {
      await useIdentity.getState().bootstrap();
    });

    const state = useIdentity.getState();
    expect(state.status).toBe("bootstrapping");
    expect(state.error).toBe("network unreachable");
  });

  it("bootstrap catches a getDoc failure and sets an error instead of throwing", async () => {
    (signInAnonymously as jest.Mock).mockResolvedValue({ user: { uid: "uid-4" } });
    (getDoc as jest.Mock).mockRejectedValue(new Error("firestore unreachable"));

    await act(async () => {
      await useIdentity.getState().bootstrap();
    });

    const state = useIdentity.getState();
    expect(state.status).toBe("bootstrapping");
    expect(state.error).toBe("firestore unreachable");
  });

  it("confirmIdentity catches a setDoc failure, sets an error, and rethrows", async () => {
    useIdentity.setState({ uid: "uid-5" });
    (setDoc as jest.Mock).mockRejectedValue(new Error("write denied"));

    await expect(useIdentity.getState().confirmIdentity()).rejects.toThrow("write denied");

    const state = useIdentity.getState();
    expect(state.status).toBe("bootstrapping");
    expect(state.error).toBe("write denied");
  });

  it("resetIdentity signs out, clears identity, and bootstraps a fresh one", async () => {
    useIdentity.setState({ status: "ready", uid: "uid-old", displayId: "old-name", avatarSeed: "old-seed" });
    (signInAnonymously as jest.Mock).mockResolvedValue({ user: { uid: "uid-new" } });
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    await act(async () => {
      await useIdentity.getState().resetIdentity();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    const state = useIdentity.getState();
    expect(state.status).toBe("needs-identity");
    expect(state.uid).toBe("uid-new");
    expect(state.displayId).toBeNull();
  });
});
