import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { AnimalType } from '@/lib/queries/animals';

const EMOJIS: Record<AnimalType, string> = {
  dairy:      '🐄',
  layers:     '🥚',
  meat_birds: '🐔',
};

const ACTIONS: Record<AnimalType, string> = {
  dairy:      'Log first milking session',
  layers:     'Log first egg collection',
  meat_birds: 'View your batch',
};

export default function ReadyScreen() {
  const { name, type } = useLocalSearchParams<{ name: string; type: AnimalType }>();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.emoji}>{EMOJIS[type]}</Text>
        <Text style={styles.title}>You're all set.</Text>
        <Text style={styles.subtitle}>
          <Text style={styles.name}>{name}</Text> is ready to track.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.primaryButtonText}>{ACTIONS[type]}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.secondaryButtonText}>Go to dashboard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.linen,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 60,
  },
  hero: {
    alignItems: 'center',
    gap: 16,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.charcoal,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.charcoal,
    opacity: 0.7,
    textAlign: 'center',
  },
  name: {
    fontWeight: '700',
    opacity: 1,
    color: Colors.charcoal,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.sage,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: Colors.cream,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.charcoal,
  },
});
