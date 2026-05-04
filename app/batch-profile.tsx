import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function BatchProfileScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Animals</Text>
      </Pressable>
      <Text style={styles.placeholder}>Meat bird batch — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.linen, padding: 24 },
  backButton: { marginBottom: 24 },
  backText: { fontSize: 16, color: Colors.sage, fontWeight: '600' },
  placeholder: { fontSize: 16, color: Colors.charcoal, opacity: 0.4, textAlign: 'center', marginTop: 60 },
});
