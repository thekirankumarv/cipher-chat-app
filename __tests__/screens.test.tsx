import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import WelcomeScreen from "../app/index";
import CreateIdentityScreen from "../app/create-identity";
import HomeScreen from "../app/home";
import ConnectScreen from "../app/connect";
import ChatScreen from "../app/chat/[id]";
import MediaViewerScreen from "../app/media-viewer";
import ChatInfoScreen from "../app/chat-info";
import SettingsScreen from "../app/settings";
import SearchScreen from "../app/search";

const screens: Array<[string, React.ComponentType, string]> = [
  ["Welcome", WelcomeScreen, "Welcome / Splash"],
  ["CreateIdentity", CreateIdentityScreen, "Create Identity"],
  ["Home", HomeScreen, "Home / Chat List"],
  ["Connect", ConnectScreen, "Connect Sheet"],
  ["Chat", ChatScreen, "Chat Screen"],
  ["MediaViewer", MediaViewerScreen, "Media Viewer"],
  ["ChatInfo", ChatInfoScreen, "Chat Info"],
  ["Settings", SettingsScreen, "Settings"],
  ["Search", SearchScreen, "In-chat Search"],
];

describe("stub screens", () => {
  test.each(screens)("%s renders its title", async (_name, Component, title) => {
    const { findByText } = await render(
      <ThemeProvider>
        <Component />
      </ThemeProvider>
    );
    expect(await findByText(title)).toBeTruthy();
  });
});
