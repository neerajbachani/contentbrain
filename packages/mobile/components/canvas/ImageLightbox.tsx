import { Modal, View, Image, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { XIcon } from "phosphor-react-native";
import { useTheme } from "../../theme";

type Props = {
  uri: string | null;
  onClose: () => void;
};

export default function ImageLightbox({ uri, onClose }: Props) {
  const theme = useTheme();

  if (!uri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <TouchableOpacity style={styles.close} onPress={onClose}>
          <XIcon size={24} color="#fff" />
        </TouchableOpacity>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  image: { width: "100%", height: "80%" },
  close: { position: "absolute", top: 56, right: 20, zIndex: 2, padding: 8 },
});
