import {
  StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { getLayRate } from '@/lib/queries/eggs';

export default function FlockProfileScreen() {
  const { flockId } = useLocalSearchParams<{ flockId: string }>();
  const router = useRouter();
  const [flock, setFlock] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    const [flockRes, collectionsRes] = await Promise.all([
      supabase.from('flocks').select('*').eq('id', flockId).single(),
      supabase.from('egg_collections').select('*').eq('flock_id', flockId)
        .gte('collection_date', cutoff.toISOString().split('T')[0])
        .order('collection_date', { ascending: false }),
    ]);
    setFlock(flockRes.data);
    setCollections(collectionsRes.data ?? []);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [flockId]));

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={Colors.sage} size="large" /></View>;
  }

  if (!flock) {
    return <View style={styles.centered}><Text>Flock not found.</Text></View>;
  }

  const sevenDayTotal = collections
    .filter(c => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      return new Date(c.collection_date) >= cutoff;
    })
    .reduce((sum, c) => sum + c.egg_count, 0);

  const avgLayRate = collections.length > 0
    ? Math.round(collections.reduce((sum, c) => sum + getLayRate(c.egg_count, flock.hen_count), 0) / collections.length)
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Animals</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.emoji}>🥚</Text>
        <View>
          <Text style={styles.name}>{flock.name}</Text>
          <Text style={styles.meta}>{flock.hen_count} hens · {flock.status}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="7-day eggs" value={String(sevenDayTotal)} />
        <StatCard label="Avg lay rate" value={avgLayRate !== null ? `${avgLayRate}%` : '—'} hint="14 days" />
        <StatCard label="Flock size" value={String(flock.hen_count)} hint="hens" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent collections</Text>
        {collections.length === 0 ? (
          <Text style={styles.empty}>No collections logged yet.</Text>
        ) : (
          <View style={styles.list}>
            {collections.map(c => (
              <View key={c.id} style={styles.row}>
                <Text style={styles.rowDate}>
                  {new Date(c.collection_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <View style={styles.rowRight}>
                  {(c.broken_count > 0 || c.soft_shell_count > 0) && (
                    <Text style={styles.rowFlags}>
                      {[
                        c.broken_count > 0 ? `${c.broken_count} broken` : null,
                        c.soft_shell_count > 0 ? `${c.soft_shell_count} soft` : null,
                      ].filter(Boolean).join(', ')}
                    </Text>
                  )}
                  <Text style={styles.rowCount}>{c.egg_count} eggs</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.logButton, pressed && { opacity: 0.8 }]}
        onPress={() => router.push({ pathname: '/log-eggs', params: { flockId: flock.id, flockName: flock.name } })}
      >
        <Text style={styles.logButtonText}>Log egg collection</Text>
      </Pressable>
    </ScrollView>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint && <Text style={styles.statHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.linen },
  centered: { flex: 1, backgroundColor: Colors.linen, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, gap: 20, paddingBottom: 48 },
  backButton: { marginBottom: 4 },
  backText: { fontSize: 16, color: Colors.sage, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  emoji: { fontSize: 48 },
  name: { fontSize: 28, fontWeight: '800', color: Colors.charcoal, letterSpacing: -0.5 },
  meta: { fontSize: 14, color: Colors.charcoal, opacity: 0.5, marginTop: 2, textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.cream,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    gap: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.charcoal },
  statLabel: { fontSize: 12, color: Colors.charcoal, opacity: 0.5, fontWeight: '500' },
  statHint: { fontSize: 11, color: Colors.charcoal, opacity: 0.35 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.charcoal,
    opacity: 0.4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  empty: { fontSize: 14, color: Colors.charcoal, opacity: 0.4, paddingVertical: 20, textAlign: 'center' },
  list: {
    backgroundColor: Colors.cream,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowDate: { fontSize: 14, fontWeight: '600', color: Colors.charcoal },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowFlags: { fontSize: 11, color: Colors.rust, fontWeight: '600' },
  rowCount: { fontSize: 16, fontWeight: '800', color: Colors.charcoal },
  logButton: {
    backgroundColor: Colors.sage,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  logButtonText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
