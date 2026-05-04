import {
  StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { getRecentSessions, toGallons, getDIM } from '@/lib/queries/milking';

export default function AnimalProfileScreen() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const router = useRouter();
  const [animal, setAnimal] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [animalRes, sessionsData] = await Promise.all([
      supabase.from('animals').select('*').eq('id', animalId).single(),
      getRecentSessions(animalId, 14),
    ]);
    setAnimal(animalRes.data);
    setSessions(sessionsData);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [animalId]));

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={Colors.sage} size="large" /></View>;
  }

  if (!animal) {
    return <View style={styles.centered}><Text>Animal not found.</Text></View>;
  }

  const dim = animal.freshening_date ? getDIM(animal.freshening_date) : null;

  // 7-day total
  const sevenDayTotal = sessions
    .filter(s => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      return new Date(s.session_time) >= cutoff;
    })
    .reduce((sum, s) => sum + toGallons(s.yield_lbs), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Animals</Text>
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.emoji}>🐄</Text>
        <View>
          <Text style={styles.name}>{animal.name}</Text>
          <Text style={styles.meta}>
            {[animal.breed, animal.species].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Days in milk" value={dim !== null ? String(dim) : '—'} />
        <StatCard label="7-day total" value={`${sevenDayTotal.toFixed(1)} gal`} />
        <StatCard label="Sessions" value={String(sessions.length)} hint="14 days" />
      </View>

      {/* Freshening date */}
      {animal.freshening_date && (
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Freshened</Text>
          <Text style={styles.infoValue}>{new Date(animal.freshening_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
        </View>
      )}

      {/* Recent sessions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent sessions</Text>
        {sessions.length === 0 ? (
          <Text style={styles.empty}>No sessions logged yet.</Text>
        ) : (
          <View style={styles.sessionList}>
            {sessions.slice(0, 20).map(session => (
              <SessionRow key={session.id} session={session} />
            ))}
          </View>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.logButton, pressed && { opacity: 0.8 }]}
        onPress={() => router.push({ pathname: '/log-milking', params: { animalId: animal.id, animalName: animal.name } })}
      >
        <Text style={styles.logButtonText}>Log session</Text>
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

function SessionRow({ session }: { session: any }) {
  const date = new Date(session.session_time);
  const gallons = toGallons(session.yield_lbs);
  return (
    <View style={styles.sessionRow}>
      <View style={styles.sessionLeft}>
        <Text style={styles.sessionDate}>
          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
        <View style={[styles.sessionBadge, session.session_type === 'AM' ? styles.amBadge : styles.pmBadge]}>
          <Text style={styles.sessionBadgeText}>{session.session_type}</Text>
        </View>
      </View>
      <Text style={styles.sessionYield}>{gallons.toFixed(1)} gal</Text>
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
  meta: { fontSize: 14, color: Colors.charcoal, opacity: 0.5, marginTop: 2 },
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
  infoCard: {
    backgroundColor: Colors.cream,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 14, fontWeight: '600', color: Colors.charcoal, opacity: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '700', color: Colors.charcoal },
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
  sessionList: {
    backgroundColor: Colors.cream,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sessionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionDate: { fontSize: 14, fontWeight: '600', color: Colors.charcoal },
  sessionBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  amBadge: { backgroundColor: '#FEF9E7' },
  pmBadge: { backgroundColor: '#EBF2EB' },
  sessionBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.charcoal },
  sessionYield: { fontSize: 16, fontWeight: '800', color: Colors.charcoal },
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
