import {
  StyleSheet, Text, View, ScrollView, Pressable,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { getTodaysSessions, yieldInUnit, getDIM, MilkingSession } from '@/lib/queries/milking';
import { getTodaysCollection, getLayRate, EggCollection } from '@/lib/queries/eggs';
import { useYieldUnit } from '@/lib/preferences';

type Animal = {
  id: string;
  name: string;
  breed: string;
  species: string;
  freshening_date: string | null;
};

type Flock = {
  id: string;
  name: string;
  hen_count: number;
  status: string;
};

type DairyCard = {
  animal: Animal;
  sessions: MilkingSession[];
};

type LayerCard = {
  flock: Flock;
  collection: EggCollection | null;
};

export default function TodayScreen() {
  const router = useRouter();
  const unit = useYieldUnit();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dairy, setDairy] = useState<DairyCard[]>([]);
  const [layers, setLayers] = useState<LayerCard[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [animalsRes, flocksRes] = await Promise.all([
      supabase.from('animals').select('*').eq('user_id', user.id),
      supabase.from('flocks').select('*').eq('user_id', user.id).eq('status', 'active'),
    ]);

    const animals: Animal[] = animalsRes.data ?? [];
    const flocks: Flock[] = flocksRes.data ?? [];

    const dairyCards = await Promise.all(
      animals.map(async (animal) => ({
        animal,
        sessions: await getTodaysSessions(animal.id),
      }))
    );

    const layerCards = await Promise.all(
      flocks.map(async (flock) => ({
        flock,
        collection: await getTodaysCollection(flock.id),
      }))
    );

    setDairy(dairyCards);
    setLayers(layerCards);
  }

  async function fetchAll() {
    try {
      await loadData();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

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
        <Text style={styles.date}>{today}</Text>

        {dairy.map(({ animal, sessions }) => (
          <DairyCard
            key={animal.id}
            animal={animal}
            sessions={sessions}
            unit={unit}
            onLog={() => router.push({ pathname: '/log-milking', params: { animalId: animal.id, animalName: animal.name } })}
          />
        ))}

        {layers.map(({ flock, collection }) => (
          <LayerCard
            key={flock.id}
            flock={flock}
            collection={collection}
            onLog={() => router.push({ pathname: '/log-eggs', params: { flockId: flock.id, flockName: flock.name } })}
          />
        ))}

        {dairy.length === 0 && layers.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No animals set up yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DairyCard({ animal, sessions, unit, onLog }: {
  animal: Animal;
  sessions: MilkingSession[];
  unit: 'gal' | 'lbs';
  onLog: () => void;
}) {
  const total = sessions.reduce((sum, s) => sum + yieldInUnit(s.yield_lbs, unit), 0);
  const hasAM = sessions.some(s => s.session_type === 'AM');
  const hasPM = sessions.some(s => s.session_type === 'PM');
  const dim = animal.freshening_date ? getDIM(animal.freshening_date) : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{animal.name}</Text>
          <Text style={styles.cardSubtitle}>{animal.breed ?? 'Dairy'}{dim !== null ? ` · Day ${dim}` : ''}</Text>
        </View>
        <Text style={styles.cardEmoji}>🐄</Text>
      </View>

      <View style={styles.metric}>
        <Text style={styles.metricValue}>
          {total > 0 ? total.toFixed(1) : '—'}
        </Text>
        <Text style={styles.metricUnit}>{unit === 'lbs' ? 'lbs today' : 'gal today'}</Text>
      </View>

      <View style={styles.sessionRow}>
        <SessionBadge label="AM" done={hasAM} />
        <SessionBadge label="PM" done={hasPM} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.logButton, pressed && styles.logButtonPressed]}
        onPress={onLog}
      >
        <Text style={styles.logButtonText}>
          {sessions.length === 0 ? 'Log first session' : 'Log another session'}
        </Text>
      </Pressable>
    </View>
  );
}

function LayerCard({ flock, collection, onLog }: {
  flock: Flock;
  collection: EggCollection | null;
  onLog: () => void;
}) {
  const layRate = collection ? getLayRate(collection.egg_count, flock.hen_count) : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{flock.name}</Text>
          <Text style={styles.cardSubtitle}>{flock.hen_count} hens</Text>
        </View>
        <Text style={styles.cardEmoji}>🥚</Text>
      </View>

      <View style={styles.metric}>
        <Text style={styles.metricValue}>
          {collection ? collection.egg_count : '—'}
        </Text>
        <Text style={styles.metricUnit}>
          eggs today{layRate !== null ? ` · ${layRate}% lay rate` : ''}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.logButton, pressed && styles.logButtonPressed]}
        onPress={onLog}
      >
        <Text style={styles.logButtonText}>
          {collection ? 'Update today\'s count' : 'Log egg collection'}
        </Text>
      </Pressable>
    </View>
  );
}

function SessionBadge({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={[styles.badge, done && styles.badgeDone]}>
      <Text style={[styles.badgeText, done && styles.badgeTextDone]}>
        {done ? '✓' : '·'} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.linen,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.linen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  date: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.charcoal,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  card: {
    backgroundColor: Colors.cream,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 20,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.charcoal,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.charcoal,
    opacity: 0.5,
    marginTop: 2,
  },
  cardEmoji: {
    fontSize: 28,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  metricValue: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.charcoal,
    lineHeight: 52,
  },
  metricUnit: {
    fontSize: 15,
    color: Colors.charcoal,
    opacity: 0.5,
    fontWeight: '500',
  },
  sessionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    backgroundColor: Colors.linen,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeDone: {
    backgroundColor: '#EBF2EB',
    borderColor: Colors.sage,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.charcoal,
    opacity: 0.5,
  },
  badgeTextDone: {
    color: Colors.sage,
    opacity: 1,
  },
  logButton: {
    backgroundColor: Colors.sage,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  logButtonPressed: {
    opacity: 0.8,
  },
  logButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.charcoal,
    opacity: 0.4,
  },
});
