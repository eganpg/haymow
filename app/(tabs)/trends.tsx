import {
  StyleSheet, Text, View, ScrollView, Pressable,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { getDailyYields, yieldInUnit, DailyYield } from '@/lib/queries/milking';
import { getDailyGrainLbs, DailyFeedTotal } from '@/lib/queries/feed';
import { useYieldUnit } from '@/lib/preferences';

type Animal = { id: string; name: string; breed: string | null };
type Range = 7 | 30 | 90;

const RANGES: Range[] = [7, 30, 90];

export default function TrendsScreen() {
  const unit = useYieldUnit();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(7);
  const [showFeed, setShowFeed] = useState(false);
  const [yields, setYields] = useState<DailyYield[]>([]);
  const [feed, setFeed] = useState<DailyFeedTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAnimals() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('animals')
      .select('id, name, breed')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    const list: Animal[] = data ?? [];
    setAnimals(list);
    if (!animalId && list.length > 0) setAnimalId(list[0].id);
  }

  async function loadData(id: string, r: Range) {
    const [y, f] = await Promise.all([
      getDailyYields(id, r),
      getDailyGrainLbs(id, r),
    ]);
    setYields(y);
    setFeed(f);
  }

  async function refresh() {
    try {
      await loadAnimals();
      if (animalId) await loadData(animalId, range);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => {
    refresh();
  }, [animalId, range]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
  }, [animalId, range]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.sage} size="large" />
      </View>
    );
  }

  if (animals.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No dairy animals yet</Text>
        <Text style={styles.emptyBody}>Add an animal to start seeing yield trends.</Text>
      </View>
    );
  }

  const totalLbs = yields.reduce((s, d) => s + d.totalLbs, 0);
  const daysWithData = yields.filter(d => d.sessionCount > 0).length;
  const total = yieldInUnit(totalLbs, unit);
  const avgPerDay = daysWithData > 0 ? yieldInUnit(totalLbs / daysWithData, unit) : 0;
  const unitLabel = unit === 'lbs' ? 'lbs' : 'gal';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.sage} />}
      >
        <Text style={styles.title}>Trends</Text>

        {animals.length > 1 && (
          <View style={styles.pillRow}>
            {animals.map(a => (
              <Pill key={a.id} label={a.name} active={a.id === animalId} onPress={() => setAnimalId(a.id)} />
            ))}
          </View>
        )}

        <View style={styles.pillRow}>
          {RANGES.map(r => (
            <Pill key={r} label={`${r}d`} active={r === range} onPress={() => setRange(r)} />
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{total.toFixed(1)}</Text>
              <Text style={styles.statLabel}>{unitLabel} total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{avgPerDay.toFixed(1)}</Text>
              <Text style={styles.statLabel}>{unitLabel} / day avg</Text>
            </View>
          </View>

          <BarChart data={yields} unit={unit} />

          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>{formatShort(yields[0]?.date)}</Text>
            <Text style={styles.dateLabel}>Today</Text>
          </View>
        </View>

        <Pressable
          onPress={() => setShowFeed(v => !v)}
          style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
        >
          <Text style={styles.toggleLabel}>Show feed (grain, lbs)</Text>
          <View style={[styles.toggleSwitch, showFeed && styles.toggleSwitchOn]}>
            <View style={[styles.toggleKnob, showFeed && styles.toggleKnobOn]} />
          </View>
        </Pressable>

        {showFeed && (
          <View style={styles.card}>
            <Text style={styles.feedHeader}>Grain fed</Text>
            <FeedChart data={feed} />
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>{formatShort(feed[0]?.date)}</Text>
              <Text style={styles.dateLabel}>Today</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function BarChart({ data, unit }: { data: DailyYield[]; unit: 'gal' | 'lbs' }) {
  const values = data.map(d => yieldInUnit(d.totalLbs, unit));
  const max = Math.max(1, ...values);
  return (
    <View style={styles.chart}>
      {data.map((d, i) => {
        const v = values[i];
        const heightPct = (v / max) * 100;
        const isEmpty = v === 0;
        return (
          <View key={d.date} style={styles.barCell}>
            <View
              style={[
                styles.bar,
                {
                  height: `${isEmpty ? 1 : heightPct}%`,
                  backgroundColor: isEmpty ? Colors.border : Colors.sage,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function FeedChart({ data }: { data: DailyFeedTotal[] }) {
  const max = Math.max(1, ...data.map(d => d.grainLbs));
  return (
    <View style={styles.feedChart}>
      {data.map(d => {
        const v = d.grainLbs;
        const heightPct = (v / max) * 100;
        const isEmpty = v === 0;
        return (
          <View key={d.date} style={styles.barCell}>
            <View
              style={[
                styles.bar,
                {
                  height: `${isEmpty ? 1 : heightPct}%`,
                  backgroundColor: isEmpty ? Colors.border : Colors.gold,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function formatShort(date: string | undefined): string {
  if (!date) return '';
  const [, m, d] = date.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.linen },
  centered: {
    flex: 1, backgroundColor: Colors.linen,
    alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8,
  },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: {
    fontSize: 28, fontWeight: '800', color: Colors.charcoal,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.charcoal },
  emptyBody: { fontSize: 14, color: Colors.charcoal, opacity: 0.5, textAlign: 'center' },

  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.cream, minHeight: 36, justifyContent: 'center',
  },
  pillActive: { backgroundColor: Colors.sage, borderColor: Colors.sage },
  pillText: { fontSize: 14, fontWeight: '600', color: Colors.charcoal, opacity: 0.7 },
  pillTextActive: { color: Colors.white, opacity: 1 },
  pressed: { opacity: 0.7 },

  card: {
    backgroundColor: Colors.cream, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.border,
    padding: 20, gap: 16,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stat: { flex: 1 },
  statValue: { fontSize: 32, fontWeight: '800', color: Colors.charcoal, lineHeight: 36 },
  statLabel: { fontSize: 13, color: Colors.charcoal, opacity: 0.5, fontWeight: '500', marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.border },

  chart: {
    height: 160, flexDirection: 'row', alignItems: 'flex-end', gap: 2,
  },
  feedChart: {
    height: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 2,
  },
  barCell: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2 },

  dateRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dateLabel: { fontSize: 12, color: Colors.charcoal, opacity: 0.4, fontWeight: '500' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.cream, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, minHeight: 48,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: Colors.charcoal },
  toggleSwitch: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: Colors.border, padding: 2, justifyContent: 'center',
  },
  toggleSwitchOn: { backgroundColor: Colors.sage },
  toggleKnob: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white,
  },
  toggleKnobOn: { transform: [{ translateX: 18 }] },

  feedHeader: { fontSize: 15, fontWeight: '700', color: Colors.charcoal },
});
