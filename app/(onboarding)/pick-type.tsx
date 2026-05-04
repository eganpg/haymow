import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { AnimalType } from '@/lib/queries/animals';

const TYPES: { type: AnimalType; emoji: string; label: string; description: string }[] = [
  { type: 'dairy',      emoji: '🐄', label: 'Dairy Animals', description: 'Cows, milk sessions, lactation tracking' },
  { type: 'layers',     emoji: '🥚', label: 'Layer Hens',    description: 'Egg collection, lay rate, cost per dozen' },
  { type: 'meat_birds', emoji: '🐔', label: 'Meat Birds',    description: 'Batch tracking, weight, cost per lb' },
];

export default function PickTypeScreen() {
  const router = useRouter();

  function handleSelect(type: AnimalType) {
    router.push({ pathname: '/(onboarding)/setup-animal', params: { type } });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>What do you raise?</Text>
        <Text style={styles.subtitle}>Pick what you want to track. You can add more later.</Text>
      </View>

      <View style={styles.cards}>
        {TYPES.map(({ type, emoji, label, description }) => (
          <Pressable
            key={type}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => handleSelect(type)}
          >
            <Text style={styles.emoji}>{emoji}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardLabel}>{label}</Text>
              <Text style={styles.cardDescription}>{description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.linen,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.charcoal,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.charcoal,
    opacity: 0.6,
  },
  cards: {
    gap: 12,
  },
  card: {
    backgroundColor: Colors.cream,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 80,
  },
  cardPressed: {
    borderColor: Colors.sage,
    backgroundColor: '#F0F5F0',
  },
  emoji: {
    fontSize: 32,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.charcoal,
  },
  cardDescription: {
    fontSize: 13,
    color: Colors.charcoal,
    opacity: 0.55,
  },
  chevron: {
    fontSize: 24,
    color: Colors.charcoal,
    opacity: 0.3,
  },
});
