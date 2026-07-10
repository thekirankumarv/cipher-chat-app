import Svg, { Path } from "react-native-svg";
import { generateBlob } from "../lib/avatar/generateBlob";

export function Avatar({ seed, size = 48 }: { seed: string; size?: number }) {
  const { pathD, fillColor } = generateBlob(seed);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path testID="avatar-path" d={pathD} fill={fillColor} />
    </Svg>
  );
}
