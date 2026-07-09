import { View, Text } from "react-native";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, typeScale } from "../lib/theme/tokens";

export function ScreenStub({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        padding: spacing.lg,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: typeScale.screenTitle.fontSize,
          fontWeight: typeScale.screenTitle.fontWeight,
        }}
      >
        {title}
      </Text>
    </View>
  );
}
