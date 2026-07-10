import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { useIdentity } from "../lib/identity/useIdentity";
import { useChats } from "../lib/chat/useChats";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: "chat-1" }),
}));
jest.mock("../lib/identity/useIdentity", () => ({ useIdentity: jest.fn() }));
jest.mock("../lib/chat/useChats", () => ({ useChats: jest.fn() }));

const mockChatsSubscribe = jest.fn(() => jest.fn());
const mockPresenceSubscribe = jest.fn(() => jest.fn());
jest.mock("../lib/presence/useUserPresence", () => ({
  useUserPresence: jest.fn((selector: any) =>
    selector({ byUid: { "other-uid": { online: true, lastSeen: 1000 } }, subscribe: mockPresenceSubscribe }),
  ),
  formatLastSeen: () => "Last seen 5m ago",
}));

import ChatInfoScreen from "../app/chat-info";

describe("ChatInfoScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useIdentity as unknown as jest.Mock).mockImplementation((selector: any) => selector({ uid: "my-uid" }));
  });

  it("shows a loading state before chat metadata resolves", async () => {
    (useChats as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ chats: [], subscribe: mockChatsSubscribe }),
    );
    const { findByText } = await render(
      <ThemeProvider>
        <ChatInfoScreen />
      </ThemeProvider>
    );
    expect(await findByText("Loading…")).toBeTruthy();
  });

  it("shows the other participant's name, avatar, presence, and disappearing setting", async () => {
    (useChats as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        chats: [
          {
            id: "chat-1", otherUid: "other-uid", otherDisplayId: "swift-otter-42", otherAvatarSeed: "seed-1",
            disappearingDuration: "24h",
          },
        ],
        subscribe: mockChatsSubscribe,
      }),
    );
    const { findByText, findByTestId } = await render(
      <ThemeProvider>
        <ChatInfoScreen />
      </ThemeProvider>
    );
    expect(await findByText("swift-otter-42")).toBeTruthy();
    expect(await findByTestId("chat-info-presence")).toBeTruthy();
    expect(await findByText(/disappear after 24h/)).toBeTruthy();
  });
});
