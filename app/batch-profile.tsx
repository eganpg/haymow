import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Colors } from '@/constants/Colors';
import { MEAT_BIRDS_ENABLED } from '@/lib/features';

export default function BatchProfileScreen() {
  const router = useRouter();

  // Defense-in-depth: even though the Animals tab doesn't surface batch rows
  // when the MVP flag is off, a stale deep link or in-app navigation could
  // still land a user here. Bounce them back to the animals list so the app
  // never shows a meat-bird surface that the rest of the UI is hiding.
  useEffect(() => {
    if (!MEAT_BIRDS_ENABLED) {
      router.replace('/(tabs)/animals');
    }
  }, [router]);

  if (!MEAT_BIRDS_ENABLED) return null;

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
