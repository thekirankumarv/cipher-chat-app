import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, radii, typeScale } from "../lib/theme/tokens";
import { useMessages } from "../lib/chat/useMessages";

function formatTime(ms: number | null) {
  if (!ms) return "";
  return new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SearchScreen() {
  const { chatId: rawChatId } = useLocalSearchParams<{ chatId: string }>();
  const chatId = Array.isArray(rawChatId) ? rawChatId[0] : rawChatId;
  const { colors } = useTheme();
  const router = useRouter();
  const messages = useMessages((s) => s.messages);
  const subscribe = useMessages((s) => s.subscribe);

  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!chatId) return;
    const unsubscribe = subscribe(chatId);
    return unsubscribe;
  }, [chatId, subscribe]);

  const trimmed = query.trim().toLowerCase();
  const results = trimmed
    ? messages.filter((m) => !m.deleted && m.text.toLowerCase().includes(trimmed))
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable testID="search-back" onPress={() => router.back()} style={{ marginRight: spacing.md }}>
          <Text style={{ color: colors.accent, fontSize: typeScale.header.fontSize }}>‹</Text>
        </Pressable>
        <TextInput
          testID="search-input"
          value={query}
          onChangeText={setQuery}
          placeholder="Search this chat"
          placeholderTextColor={colors.textTertiary}
          autoFocus
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.card,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.text,
          }}
        />
      </View>

      {trimmed ? (
        <Text
          testID="search-match-count"
          style={{ color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}
        >
          {results.length} {results.length === 1 ? "match" : "matches"}
        </Text>
      ) : null}

      <FlatList
        testID="search-results"
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <Pressable
            testID={`search-result-${item.id}`}
            onPress={() => chatId && router.replace(`/chat/${chatId}`)}
            style={{
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text numberOfLines={2} style={{ color: colors.text }}>
              {item.text}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: typeScale.meta.fontSize, marginTop: 2 }}>
              {formatTime(item.createdAt)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
