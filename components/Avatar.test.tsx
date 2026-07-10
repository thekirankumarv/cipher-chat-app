import React from "react";
import { render } from "@testing-library/react-native";
import { processColor } from "react-native";
import { generateBlob } from "../lib/avatar/generateBlob";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders an SVG path matching the seed's generated blob", async () => {
    const seed = "quiet-falcon-42";
    const expected = generateBlob(seed);
    const { findByTestId } = await render(<Avatar seed={seed} />);
    const path = await findByTestId("avatar-path");
    expect(path.props.d).toBe(expected.pathD);
    expect(path.props.fill).toEqual({
      type: 0,
      payload: processColor(expected.fillColor),
    });
  });
});
