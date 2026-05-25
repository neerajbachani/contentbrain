import {
  Modal, View, Text, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, Alert, Linking, Pressable, Platform,
} from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { XIcon, DownloadSimpleIcon, ArrowSquareOutIcon } from "phosphor-react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";

type Props = {
  visible: boolean;
  imageUrl: string;
  postUrl?: string;
  title?: string;
  onClose: () => void;
};

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    title: { color: "#fff", fontSize: 14, fontWeight: "600", flex: 1, marginRight: 12 },
    iconBtn: { padding: 8 },
    imageWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
    image: { width: "100%", height: "100%" },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 24,
      paddingVertical: 20,
      paddingHorizontal: 16,
    },
    action: { flexDirection: "row", alignItems: "center", gap: 8 },
    actionText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  });
}

export default function ImageLightbox({ visible, imageUrl, postUrl, title, onClose }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (Platform.OS === "web") {
      // On web: open image in new tab (browser handles save)
      window.open(imageUrl, "_blank");
      return;
    }

    setDownloading(true);
    try {
      // Lazy-load native modules only on native
      const [FileSystem, MediaLibrary] = await Promise.all([
        import("expo-file-system/legacy"),
        import("expo-media-library"),
      ]);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo library access to save images.");
        return;
      }
      const ext = imageUrl.includes(".png") ? "png" : "jpg";
      const dest = `${FileSystem.cacheDirectory}meme-${Date.now()}.${ext}`;
      const result = await FileSystem.downloadAsync(imageUrl, dest);
      await MediaLibrary.saveToLibraryAsync(result.uri);
      Alert.alert("Saved", "Image saved to your photo library.");
    } catch {
      try {
        await Linking.openURL(imageUrl);
      } catch {
        Alert.alert("Download failed", "Could not save this image. Try opening in browser.");
      }
    } finally {
      setDownloading(false);
    }
  }

  async function openPost() {
    if (postUrl) await Linking.openURL(postUrl);
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title ?? "Meme"}</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <XIcon size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <Pressable style={styles.imageWrap} onPress={onClose}>
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
        </Pressable>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.action} onPress={download} disabled={downloading}>
            {downloading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <DownloadSimpleIcon size={22} color="#fff" />
            )}
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>
          {postUrl ? (
            <TouchableOpacity style={styles.action} onPress={openPost}>
              <ArrowSquareOutIcon size={22} color={theme.success} />
              <Text style={styles.actionText}>Open on X</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
