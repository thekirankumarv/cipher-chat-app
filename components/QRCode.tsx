import QRCodeSVG from "react-native-qrcode-svg";

export function QRCode({ value, size = 200 }: { value: string; size?: number }) {
  return <QRCodeSVG value={value} size={size} testID="qr-code" />;
}
