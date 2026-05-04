import {
  StyleSheet, Text, View, ScrollView, Pressable,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { getFeedInventory, FeedInventoryItem } from '@/lib/queries/feedInventory';

export default function FeedManagementScreen() {
  const router = useRouter();
  const [items, setItems] = useState<FeedInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const data = await getFeedInventory(user.id);
    setItems(data);
  }

  async function fetchAll() {
    try { await load(); } finally { setLoading(false); setRefreshing(false); }
  }

  useFocusEffect(useCallback(() => { fetchAll(); }, []));
  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(); }, []);

  const dairyItems   = items.filter(i => ['grain','hay','mineral','pasture','other'].includes(i.feed_type));
  const layerItems   = items.filter(i => ['layer-pellet','scratch','oyster-shell'].includes(i.feed_type));
  const meatItems    = items.filter(i => ['chick-starter','grower','finisher'].includes(i.feed_type));
  const otherItems   = items.filter(i => !dairyItems.includes(i) && !layerItems.includes(i) && !meatItems.includes(i));

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={Colors.sage} size="large" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.sage} />}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Settings</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/add-feed-item')}
        >
          <Text style={styles.addButtonText}>+ Add feed</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Feed inventory</Text>

      {items.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No feed on record</Text>
          <Text style={styles.emptySubtitle}>Add feed you have on hand to start tracking usage and cost.</Text>
          <Pressable
            style={({ pressed }) => [styles.emptyButton, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/add-feed-item')}
          >
            <Text style={styles.emptyButtonText}>Add first feed</Text>
          </Pressable>
        </View>
      )}

      {dairyItems.length > 0 && (
        <FeedGroup title="Dairy" items={dairyItems} onPress={(id) => router.push({ pathname: '/feed-item', params: { feedId: id } })} />
      )}
      {layerItems.length > 0 && (
        <FeedGroup title="Layers" items={layerItems} onPress={(id) => router.push({ pathname: '/feed-item', params: { feedId: id } })} />
      )}
      {meatItems.length > 0 && (
        <FeedGroup title="Meat Birds" items={meatItems} onPress={(id) => router.push({ pathname: '/feed-item', params: { feedId: id } })} />
      )}
      {otherItems.length > 0 && (
        <FeedGroup title="Other" items={otherItems} onPress={(id) => router.push({ pathname: '/feed-item', params: { feedId: id } })} />
      )}
    </ScrollView>
  );
}

function FeedGroup({ title, items, onPress }: {
  title: string;
  items: FeedInventoryItem[];
  onPress: (id: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>
        {items.map(item => {
          const isLow = item.low_stock_alert !== null && item.quantity_on_hand <= item.low_stock_alert;
          return (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onPress(item.id)}
            >
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  {isLow && <View style={styles.lowBadge}><Text style={styles.lowBadgeText}>low</Text></View>}
                </View>
                <Text style={styles.rowSub}>
                  {item.quantity_on_hand.toFixed(1)} {item.unit} on hand
                  {item.cost_per_unit ? ` · $${item.cost_per_unit.toFixed(2)}/${item.unit}` : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.linen },
  centered: { flex: 1, backgroundColor: Colors.linen, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: {},
  backText: { fontSize: 16, color: Colors.sage, fontWeight: '600' },
  addButton: { backgroundColor: Colors.sage, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  addButtonText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  heading: { fontSize: 28, fontWeight: '800', color: Colors.charcoal, letterSpacing: -0.5 },
  empty: {
    backgroundColor: Colors.cream,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.charcoal },
  emptySubtitle: { fontSize: 14, color: Colors.charcoal, opacity: 0.5, textAlign: 'center', lineHeight: 20 },
  emptyButton: {
    backgroundColor: Colors.sage, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 4,
  },
  emptyButtonText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  group: { gap: 6 },
  groupTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.charcoal, opacity: 0.4,
    textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 4,
  },
  groupCard: {
    backgroundColor: Colors.cream, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowPressed: { backgroundColor: '#F5F0E0' },
  rowMain: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 16, fontWeight: '700', color: Colors.charcoal },
  rowSub: { fontSize: 13, color: Colors.charcoal, opacity: 0.5 },
  lowBadge: { backgroundColor: '#FDF0EB', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  lowBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.rust },
  chevron: { fontSize: 22, color: Colors.charcoal, opacity: 0.25 },
});
