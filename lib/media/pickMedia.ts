import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

export type PickedMedia = {
  uri: string;
  name: string;
  size: number;
  mime: string;
  kind: "image" | "video" | "file";
};

export async function pickImageOrVideo(): Promise<PickedMedia | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const kind = asset.type === "video" ? "video" : "image";
  return {
    uri: asset.uri,
    name: asset.fileName ?? `${kind}-${Date.now()}`,
    size: asset.fileSize ?? 0,
    mime: asset.mimeType ?? (kind === "video" ? "video/mp4" : "image/jpeg"),
    kind,
  };
}

export async function pickFile(): Promise<PickedMedia | null> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: false });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? 0,
    mime: asset.mimeType ?? "application/octet-stream",
    kind: "file",
  };
}
