import {
  StyleSheet, Text, View, ScrollView, Pressable,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { getUserAnimals, getUserFlocks, getUserBatches } from '@/lib/queries/flocks';
import { getDIM } from '@/lib/queries/milking';

export default function AnimalsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [animals, setAnimals] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [a, f, b] = await Promise.all([
      getUserAnimals(user.id),
      getUserFlocks(user.id),
      getUserBatches(user.id),
    ]);
    setAnimals(a);
    setFlocks(f);
    setBatches(b);
  }

  async function fetchAll() {
    try { await loadData(); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(); }, []);

  const hasNothing = animals.length === 0 && flocks.length === 0 && batches.length === 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.sage} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.sage} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Animals</Text>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/add-animal')}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </View>

        {hasNothing && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No animals set up yet.</Text>
          </View>
        )}

        {animals.length > 0 && (
          <Group title="Dairy">
            {animals.map(animal => (
              <AnimalRow
                key={animal.id}
                emoji="🐄"
                title={animal.name}
                subtitle={[
                  animal.breed,
                  animal.freshening_date ? `Day ${getDIM(animal.freshening_date)} in milk` : null,
                ].filter(Boolean).join(' · ')}
                onPress={() => router.push({ pathname: '/animal-profile', params: { animalId: animal.id } })}
              />
            ))}
          </Group>
        )}

        {flocks.length > 0 && (
          <Group title="Layer Hens">
            {flocks.map(flock => (
              <AnimalRow
                key={flock.id}
                emoji="🥚"
                title={flock.name}
                subtitle={[
                  `${flock.hen_count} hens`,
                  flock.status !== 'active' ? flock.status : null,
                ].filter(Boolean).join(' · ')}
                badge={flock.status !== 'active' ? flock.status : undefined}
                onPress={() => router.push({ pathname: '/flock-profile', params: { flockId: flock.id } })}
              />
            ))}
          </Group>
        )}

        {batches.length > 0 && (
          <Group title="Meat Birds">
            {batches.map(batch => {
              const dayOfBatch = Math.floor(
                (Date.now() - new Date(batch.intake_date).getTime()) / (1000 * 60 * 60 * 24)
              );
              return (
                <AnimalRow
                  key={batch.id}
                  emoji="🐔"
                  title={`${batch.breed} batch`}
                  subtitle={[
                    `${batch.chick_count} birds`,
                    batch.status === 'active' ? `Day ${dayOfBatch}` : 'Processed',
                  ].join(' · ')}
                  badge={batch.status === 'processed' ? 'processed' : undefined}
                  onPress={() => router.push({ pathname: '/batch-profile', params: { batchId: batch.id } })}
                />
              );
            })}
          </Group>
        )}
      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

function AnimalRow({ emoji, title, subtitle, badge, onPress }: {
  emoji: string;
  title: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.linen },
  centered: { flex: 1, backgroundColor: Colors.linen, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.charcoal,
    letterSpacing: -0.5,
  },
  addButton: {
    backgroundColor: Colors.sage,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: Colors.charcoal, opacity: 0.4 },
  group: { gap: 6 },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.charcoal,
    opacity: 0.4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  groupCard: {
    backgroundColor: Colors.cream,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowPressed: { backgroundColor: '#F5F0E0' },
  rowEmoji: { fontSize: 24, width: 36, textAlign: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: Colors.charcoal },
  rowSubtitle: { fontSize: 13, color: Colors.charcoal, opacity: 0.5 },
  badge: {
    backgroundColor: Colors.linen,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: Colors.charcoal, opacity: 0.5, textTransform: 'capitalize' },
  chevron: { fontSize: 22, color: Colors.charcoal, opacity: 0.25 },
});
