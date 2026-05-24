import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView } from "react-native";
import { PlusIcon, XIcon, CheckIcon, CaretDownIcon } from "phosphor-react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import { typography } from "../../constants/typography";
import type { CanvasRecord } from "../../store/canvasStore";

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
    inlineBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: theme.highlightBG,
      borderWidth: 1,
      borderColor: theme.border,
      maxWidth: 140,
    },
    inlineText: { color: theme.text, fontSize: 12, fontWeight: "600" },
    pickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.highlightBG,
      borderWidth: 1,
      borderColor: theme.border,
      maxWidth: "70%",
    },
    pickerText: { color: theme.text, fontSize: 13, fontWeight: "600" },
    addSmall: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: theme.highlightBG,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
    sheet: { backgroundColor: theme.cardBG, borderRadius: 16, padding: 16, gap: 12, maxHeight: "70%" },
    title: { ...typography.heading, color: theme.text },
    item: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    itemText: { color: theme.text, fontSize: 14, fontWeight: "500" },
    input: {
      backgroundColor: theme.highlightBG,
      color: theme.text,
      padding: 12,
      borderRadius: 10,
      fontSize: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    createBtn: {
      backgroundColor: theme.success,
      padding: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    createBtnText: { color: theme.appBG, fontWeight: "700" },
  });
}

type Props = {
  canvases: CanvasRecord[];
  activeCanvasId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  inline?: boolean;
};

export default function CanvasPicker({ canvases, activeCanvasId, onSelect, onCreate, inline = false }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const active = canvases.find((c) => c.id === activeCanvasId) ?? canvases[0];

  function handleCreate() {
    const name = newName.trim() || "Untitled Canvas";
    onCreate(name);
    setNewName("");
    setOpen(false);
  }

  const trigger = inline ? (
    <TouchableOpacity style={styles.inlineBtn} onPress={() => setOpen(true)}>
      <Text style={styles.inlineText} numberOfLines={1}>
        {active?.name ?? "Canvas"}
      </Text>
      <CaretDownIcon size={12} color={theme.textSupporting} />
    </TouchableOpacity>
  ) : (
    <View style={styles.row}>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setOpen(true)}>
        <Text style={styles.pickerText} numberOfLines={1}>
          {active?.name ?? "Canvas"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.addSmall} onPress={() => { setOpen(true); setNewName(""); }}>
        <PlusIcon size={18} color={theme.textSupporting} />
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      {trigger}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.title}>Canvases</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <XIcon size={20} color={theme.textSupporting} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {canvases.map((canvas) => (
                <TouchableOpacity
                  key={canvas.id}
                  style={styles.item}
                  onPress={() => { onSelect(canvas.id); setOpen(false); }}
                >
                  <Text style={styles.itemText}>{canvas.name}</Text>
                  {canvas.id === active?.id ? (
                    <CheckIcon size={18} color={theme.success} weight="bold" />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={styles.input}
              placeholder="New canvas name…"
              placeholderTextColor={theme.placeholderText}
              value={newName}
              onChangeText={setNewName}
            />
            <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
              <Text style={styles.createBtnText}>Create canvas</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
