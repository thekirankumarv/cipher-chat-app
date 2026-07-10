import React from "react";
import { render } from "@testing-library/react-native";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import MediaViewerScreen from "../app/media-viewer";
import ChatInfoScreen from "../app/chat-info";
import SettingsScreen from "../app/settings";
import SearchScreen from "../app/search";

const screens: Array<[string, React.ComponentType, string]> = [
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
