import {
  StyleSheet, Text, View, Pressable, TextInput,
  ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { FeedInventoryItem, getPurchaseHistory, restockFeedItem } from '@/lib/queries/feedInventory';

export default function FeedItemScreen() {
  const { feedId } = useLocalSearchParams<{ feedId: string }>();
  const router = useRouter();
  const [item, setItem] = useState<FeedInventoryItem | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRestock, setShowRestock] = useState(false);

  async function load() {
    const [itemRes, purchasesData] = await Promise.all([
      supabase.from('feed_inventory').select('*').eq('id', feedId).single(),
      getPurchaseHistory(feedId),
    ]);
    setItem(itemRes.data);
    setPurchases(purchasesData);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [feedId]));

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={Colors.sage} size="large" /></View>;
  }
  if (!item) {
    return <View style={styles.centered}><Text>Not found.</Text></View>;
  }

  const isLow = item.low_stock_alert !== null && item.quantity_on_hand <= item.low_stock_alert;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Feed inventory</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>{item.feed_type.replace(/-/g, ' ')} · {item.unit}</Text>
        </View>
        {isLow && <View style={styles.lowBadge}><Text style={styles.lowBadgeText}>LOW STOCK</Text></View>}
      </View>

      {/* Stock card */}
      <View style={styles.stockCard}>
        <View style={styles.stockMain}>
          <Text style={styles.stockValue}>{item.quantity_on_hand.toFixed(1)}</Text>
          <Text style={styles.stockUnit}>{item.unit} on hand</Text>
        </View>
        {item.cost_per_unit && (
          <Text style={styles.costPer}>${item.cost_per_unit.toFixed(2)} / {item.unit}</Text>
        )}
        {item.low_stock_alert && (
          <Text style={styles.alertLevel}>Alert below {item.low_stock_alert} {item.unit}</Text>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.restockButton, pressed && { opacity: 0.8 }]}
        onPress={() => setShowRestock(true)}
      >
        <Text style={styles.restockButtonText}>+ Restock</Text>
      </Pressable>

      {/* Purchase history */}
      {purchases.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Purchase history</Text>
          <View style={styles.list}>
            {purchases.map(p => (
              <View key={p.id} style={styles.row}>
                <Text style={styles.rowDate}>
                  {new Date(p.purchase_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <View style={styles.rowRight}>
                  {p.total_cost && <Text style={styles.rowCost}>${p.total_cost.toFixed(2)}</Text>}
                  <Text style={styles.rowQty}>+{p.quantity_purchased} {item.unit}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <RestockModal
        visible={showRestock}
        item={item}
        onClose={() => setShowRestock(false)}
        onSave={async () => { setShowRestock(false); await load(); }}
      />
    </ScrollView>
  );
}

function RestockModal({ visible, item, onClose, onSave }: {
  visible: boolean;
  item: FeedInventoryItem;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [quantity, setQuantity] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerUnit = quantity && totalCost
    ? (parseFloat(totalCost) / parseFloat(quantity)).toFixed(4)
    : null;

  async function handleSave() {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) { setError('Enter a valid quantity'); return; }

    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await restockFeedItem({
        userId: user.id,
        feedInventoryId: item.id,
        quantityPurchased: qty,
        totalCost: totalCost ? parseFloat(totalCost) : undefined,
      });

      setQuantity('');
      setTotalCost('');
      await onSave();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Restock {item.name}</Text>
            <Pressable onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></Pressable>
          </View>

          <Text style={styles.modalCurrent}>
            Currently: {item.quantity_on_hand.toFixed(1)} {item.unit} on hand
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Quantity purchased ({item.unit})</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Total cost ($) <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 22.50"
              value={totalCost}
              onChangeText={setTotalCost}
              keyboardType="decimal-pad"
            />
            {costPerUnit && (
              <Text style={styles.costCalc}>${costPerUnit} per {item.unit} — will update cost</Text>
            )}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.8 }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.saveButtonText}>Add to inventory</Text>
            }
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.linen },
  centered: { flex: 1, backgroundColor: Colors.linen, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, gap: 20, paddingBottom: 48 },
  backButton: { marginBottom: 4 },
  backText: { fontSize: 16, color: Colors.sage, fontWeight: '600' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1, gap: 3 },
  name: { fontSize: 26, fontWeight: '800', color: Colors.charcoal, letterSpacing: -0.5 },
  meta: { fontSize: 14, color: Colors.charcoal, opacity: 0.5, textTransform: 'capitalize' },
  lowBadge: { backgroundColor: '#FDF0EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  lowBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.rust, letterSpacing: 0.5 },
  stockCard: {
    backgroundColor: Colors.cream, borderRadius: 16, borderWidth: 1.5,
    borderColor: Colors.border, padding: 20, gap: 4,
  },
  stockMain: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  stockValue: { fontSize: 48, fontWeight: '800', color: Colors.charcoal, lineHeight: 52 },
  stockUnit: { fontSize: 16, color: Colors.charcoal, opacity: 0.5, fontWeight: '500' },
  costPer: { fontSize: 14, color: Colors.charcoal, opacity: 0.5 },
  alertLevel: { fontSize: 13, color: Colors.rust, opacity: 0.7 },
  restockButton: {
    backgroundColor: Colors.sage, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', minHeight: 52, justifyContent: 'center',
  },
  restockButtonText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.charcoal, opacity: 0.4,
    textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 4,
  },
  list: {
    backgroundColor: Colors.cream, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowDate: { fontSize: 14, fontWeight: '600', color: Colors.charcoal },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowCost: { fontSize: 13, color: Colors.charcoal, opacity: 0.5 },
  rowQty: { fontSize: 15, fontWeight: '700', color: Colors.sage },
  modal: { flex: 1, backgroundColor: Colors.linen },
  modalContent: { padding: 24, gap: 20, paddingBottom: 48 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.charcoal },
  modalCancel: { fontSize: 16, color: Colors.sage, fontWeight: '600' },
  modalCurrent: { fontSize: 14, color: Colors.charcoal, opacity: 0.5 },
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: '600', color: Colors.charcoal },
  optional: { fontWeight: '400', opacity: 0.5 },
  input: {
    backgroundColor: Colors.cream, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: Colors.charcoal, minHeight: 52,
  },
  costCalc: { fontSize: 13, color: Colors.sage, fontWeight: '600', paddingLeft: 4 },
  error: { color: Colors.rust, fontSize: 14 },
  saveButton: {
    backgroundColor: Colors.sage, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', minHeight: 56, justifyContent: 'center',
  },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
