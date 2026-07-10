import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "../lib/theme/ThemeProvider";
import { spacing, typeScale, radii } from "../lib/theme/tokens";
import { useInvite } from "../lib/invite/useInvite";
import { QRCode } from "../components/QRCode";

const REDEEM_ERROR_MESSAGES: Record<string, string> = {
  "not-found": "That code doesn't exist. Check it and try again.",
  used: "That code has already been used.",
  expired: "That code has expired. Ask for a new one.",
  self: "That's your own code — ask your friend for theirs.",
};

type Tab = "my-code" | "scan" | "enter-code";

export default function ConnectScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const createInvite = useInvite((state) => state.createInvite);
  const redeemInvite = useInvite((state) => state.redeemInvite);

  const [tab, setTab] = useState<Tab>("my-code");
  const [myCode, setMyCode] = useState<string | null>(null);
  const [myCodeError, setMyCodeError] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const scanLockRef = useRef(false);

  const loadMyCode = () => {
    setMyCodeError(null);
    createInvite()
      .then(setMyCode)
      .catch(() => setMyCodeError("Couldn't generate your code. Try again."));
  };

  useEffect(() => {
    loadMyCode();
  }, [createInvite]);

  const handleRedeem = async (code: string) => {
    setError(null);
    try {
      const chatId = await redeemInvite(code.trim());
      router.replace(`/chat/${chatId}`);
    } catch (err) {
      const key = err instanceof Error ? err.message : "";
      setError(REDEEM_ERROR_MESSAGES[key] ?? "Couldn't connect. Try again.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <View style={{ flexDirection: "row", marginBottom: spacing.xl, gap: spacing.sm }}>
        {(
          [
            ["my-code", "My Code"],
            ["scan", "Scan QR"],
            ["enter-code", "Enter Code"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            testID={`tab-${key}`}
            onPress={() => setTab(key)}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radii.button,
              backgroundColor: tab === key ? colors.accent : colors.surface,
            }}
          >
            <Text style={{ color: tab === key ? colors.accentInk : colors.text }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "my-code" ? (
        <View style={{ alignItems: "center" }}>
          {myCode ? (
            <>
              <QRCode value={`cipher://connect/${myCode}`} />
              <Text
                style={{
                  color: colors.text,
                  fontSize: typeScale.header.fontSize,
                  fontWeight: typeScale.header.fontWeight,
                  marginTop: spacing.lg,
                }}
              >
                {myCode}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: spacing.sm, textAlign: "center" }}>
                Share this code so a friend can connect with you
              </Text>
            </>
          ) : myCodeError ? (
            <>
              <Text style={{ color: colors.danger, textAlign: "center" }}>{myCodeError}</Text>
              <Pressable
                testID="my-code-retry"
                onPress={loadMyCode}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: radii.button,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.xxl,
                  marginTop: spacing.lg,
                }}
              >
                <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <Text style={{ color: colors.textSecondary }}>Generating your code…</Text>
          )}
        </View>
      ) : null}

      {tab === "enter-code" ? (
        <View>
          <TextInput
            testID="enter-code-input"
            value={enteredCode}
            onChangeText={setEnteredCode}
            placeholder="ALC-7F2K-9Q"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.card,
              padding: spacing.md,
              color: colors.text,
              marginBottom: spacing.md,
            }}
          />
          <Pressable
            testID="enter-code-submit"
            onPress={() => handleRedeem(enteredCode)}
            style={{
              backgroundColor: colors.accent,
              borderRadius: radii.button,
              paddingVertical: spacing.md,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Connect</Text>
          </Pressable>
          {error ? (
            <Text style={{ color: colors.danger, marginTop: spacing.md, textAlign: "center" }}>
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}

      {tab === "scan" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {!permission ? (
            <Text style={{ color: colors.textSecondary }}>Loading camera…</Text>
          ) : !permission.granted ? (
            <Pressable
              testID="camera-permission-button"
              onPress={requestPermission}
              style={{
                backgroundColor: colors.accent,
                borderRadius: radii.button,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xxl,
              }}
            >
              <Text style={{ color: colors.accentInk, fontWeight: "700" }}>Allow camera access</Text>
            </Pressable>
          ) : (
            <CameraView
              testID="camera-view"
              style={{ width: "100%", height: 300, borderRadius: radii.card }}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={
                scanned
                  ? undefined
                  : ({ data }) => {
                      if (scanLockRef.current) return;
                      scanLockRef.current = true;
                      setScanned(true);
                      const code = data.replace("cipher://connect/", "");
                      handleRedeem(code)
                        .then(() => {
                          // navigation is in flight; keep the scanner locked so the
                          // same code in frame can't be re-processed before we leave
                        })
                        .catch(() => {
                          scanLockRef.current = false;
                          setScanned(false);
                        });
                    }
              }
            />
          )}
        </View>
      ) : null}
    </View>
  );
}
