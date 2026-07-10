const REQUIRED_KEYS = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
];

const mockApp = { name: "mock-app" };
const mockAuth = { name: "mock-auth" };
const mockPersistence = { name: "mock-persistence" };
const mockDb = { name: "mock-db" };
const mockStorage = { name: "mock-storage" };

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => mockApp),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => mockApp),
}));

jest.mock("firebase/auth", () => ({
  initializeAuth: jest.fn(() => mockAuth),
  getAuth: jest.fn(() => mockAuth),
  getReactNativePersistence: jest.fn(() => mockPersistence),
}));

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => mockDb),
}));

jest.mock("firebase/storage", () => ({
  getStorage: jest.fn(() => mockStorage),
}));

describe("firebase config", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    REQUIRED_KEYS.forEach((key) => delete process.env[key]);
  });

  it("throws a clear error when env vars are missing", () => {
    expect(() => require("./config")).toThrow(/Missing Firebase config env vars/);
  });

  it("initializes app, auth, and db when env vars are present", () => {
    REQUIRED_KEYS.forEach((key) => {
      process.env[key] = `test-${key}`;
    });

    const { firebaseApp, auth, db, storage } = require("./config");
    const { initializeApp } = require("firebase/app");
    const { initializeAuth } = require("firebase/auth");
    const { getFirestore } = require("firebase/firestore");
    const { getStorage } = require("firebase/storage");

    expect(initializeApp).toHaveBeenCalledWith({
      apiKey: "test-EXPO_PUBLIC_FIREBASE_API_KEY",
      authDomain: "test-EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
      projectId: "test-EXPO_PUBLIC_FIREBASE_PROJECT_ID",
      storageBucket: "test-EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
      messagingSenderId: "test-EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      appId: "test-EXPO_PUBLIC_FIREBASE_APP_ID",
    });
    expect(initializeAuth).toHaveBeenCalledWith(mockApp, { persistence: mockPersistence });
    expect(getFirestore).toHaveBeenCalledWith(mockApp);
    expect(getStorage).toHaveBeenCalledWith(mockApp);
    expect(firebaseApp).toBe(mockApp);
    expect(auth).toBe(mockAuth);
    expect(db).toBe(mockDb);
    expect(storage).toBe(mockStorage);
  });
});
