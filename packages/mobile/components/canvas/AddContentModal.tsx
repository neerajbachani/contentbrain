import {
  View, Text, StyleSheet, Modal, TextInput, ActivityIndicator,
  ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform,
} from "react-native";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SparkleIcon, XIcon } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import { typography } from "../../constants/typography";
import { api } from "../../lib/api";
import { useCanvasStore } from "../../store/canvasStore";
import { detectPlatformFromUrl } from "./canvasUtils";

const PLATFORMS = [
  { label: "Twitter/X", value: "twitter" },
  { label: "Instagram", value: "instagram" },
  { label: "Reddit", value: "reddit" },
  { label: "YouTube", value: "youtube" },
  { label: "Blog", value: "blog" },
  { label: "Custom", value: "custom" },
];

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: theme.cardBG },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: { ...typography.heading, color: theme.text },
    modalBody: { padding: 20, gap: 16 },
    modeToggle: { flexDirection: "row", backgroundColor: theme.highlightBG, borderRadius: 10, padding: 4, gap: 4 },
    modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    modeBtnActive: { backgroundColor: theme.success },
    modeBtnText: { color: theme.textSupporting, fontSize: 14, fontWeight: "500" },
    modeBtnTextActive: { color: theme.appBG, fontWeight: "700" },
    error: { color: theme.danger, fontSize: 13, backgroundColor: "#EF444420", padding: 10, borderRadius: 8 },
    input: { backgroundColor: theme.highlightBG, color: theme.text, padding: 14, borderRadius: 12, fontSize: 15 },
    textArea: { height: 120 },
    label: { color: theme.textSupporting, fontSize: 13, fontWeight: "500" },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBG,
    },
    chipSelected: { backgroundColor: theme.success, borderColor: theme.success },
    chipText: { color: theme.textSupporting, fontSize: 13 },
    chipTextSelected: { color: theme.appBG, fontWeight: "700" },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.success,
      padding: 16,
      borderRadius: 100,
      marginTop: 8,
    },
    addBtnText: { color: theme.appBG, fontWeight: "700", fontSize: 16 },
  });
}

type Props = {
  visible: boolean;
  initialUrl?: string;
  initialText?: string;
  onClose: () => void;
  onAdded: () => void;
};

export default function AddContentModal({ visible, initialUrl, initialText, onClose, onAdded }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<"url" | "text">("text");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState("custom");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { addPendingId, removePendingId } = useCanvasStore();
  const qc = useQueryClient();

  useEffect(() => {
    if (!visible) return;
    if (initialUrl) {
      setMode("url");
      setUrl(initialUrl);
    } else if (initialText) {
      setMode("text");
      setText(initialText);
    }
  }, [visible, initialUrl, initialText]);

  useEffect(() => {
    if (mode !== "url") return;
    const detected = detectPlatformFromUrl(url);
    if (detected) setPlatform(detected);
  }, [url, mode]);

  async function handleAdd() {
    setLoading(true);
    setError("");
    const pendingId = `pending-${Date.now()}`;
    addPendingId(pendingId);

    try {
      let ogData: Record<string, string> = {};
      let rawContent = text;

      if (mode === "url") {
        if (!url) {
          setError("Enter a URL");
          setLoading(false);
          removePendingId(pendingId);
          return;
        }
        const res = await api.scrape.$post({ json: { url } });
        const data = await res.json();
        if ("title" in data) {
          ogData = data as Record<string, string>;
          rawContent = `${data.title}\n\n${data.description || ""}`;
        }
      }

      if (!rawContent.trim()) {
        setError("Enter content");
        setLoading(false);
        removePendingId(pendingId);
        return;
      }

      const res = await api.inspirations.$post({
        json: {
          rawContent: rawContent.trim(),
          sourceUrl: mode === "url" ? url : null,
          sourcePlatform: platform,
          type: "text",
          title: ogData.title || null,
          ogImage: ogData.imageUrl || null,
        },
      });

      const data = await res.json();
      if (res.status === 403) {
        setError((data as { message?: string }).message ?? "Limit reached");
        setLoading(false);
        removePendingId(pendingId);
        return;
      }

      await qc.invalidateQueries({ queryKey: ["inspirations"] });
      await qc.invalidateQueries({ queryKey: ["canvases"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUrl("");
      setText("");
      setError("");
      onAdded();
      onClose();
    } catch {
      setError("Something went wrong");
    } finally {
      removePendingId(pendingId);
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Content</Text>
          <TouchableOpacity onPress={onClose}>
            <XIcon size={22} color={theme.textSupporting} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <View style={styles.modeToggle}>
            {(["url", "text"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                  {m === "url" ? "Paste URL" : "Paste Text"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {mode === "url" ? (
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={theme.placeholderText}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          ) : (
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Paste or type content…"
              placeholderTextColor={theme.placeholderText}
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          )}

          <Text style={styles.label}>Platform</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
              {PLATFORMS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.chip, platform === p.value && styles.chipSelected]}
                  onPress={() => setPlatform(p.value)}
                >
                  <Text style={[styles.chipText, platform === p.value && styles.chipTextSelected]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.appBG} />
            ) : (
              <>
                <SparkleIcon size={18} color={theme.appBG} weight="fill" />
                <Text style={styles.addBtnText}>Add & Analyze with AI</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
