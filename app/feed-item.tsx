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
        <View style={styles.headerRight}>
          {isLow && <View style={styles.lowBadge}><Text style={styles.lowBadgeText}>LOW STOCK</Text></View>}
          <Pressable
            style={({ pressed }) => [styles.editLink, pressed && { opacity: 0.6 }]}
            onPress={() => router.push({ pathname: '/add-feed-item', params: { feedId: item.id } })}
          >
            <Text style={styles.editLinkText}>Edit</Text>
          </Pressable>
        </View>
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

type RestockMode = 'weight' | 'package';

function RestockModal({ visible, item, onClose, onSave }: {
  visible: boolean;
  item: FeedInventoryItem;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [mode, setMode] = useState<RestockMode>('weight');

  // weight mode
  const [quantity, setQuantity] = useState('');
  const [totalCost, setTotalCost] = useState('');

  // package mode
  const [packageCount, setPackageCount] = useState('');
  const [packageSize, setPackageSize] = useState('');
  const [packageCost, setPackageCost] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute the values that will be written, depending on mode.
  const computed = (() => {
    if (mode === 'weight') {
      const qty = parseFloat(quantity);
      const cost = parseFloat(totalCost);
      const validQty = !isNaN(qty) && qty > 0;
      const validCost = !isNaN(cost) && cost > 0;
      return {
        quantity: validQty ? qty : null,
        totalCost: validCost ? cost : null,
        costPerUnit: validQty && validCost ? cost / qty : null,
      };
    }
    const pkgs = parseFloat(packageCount);
    const size = parseFloat(packageSize);
    const cost = parseFloat(packageCost);
    const validPkgs = !isNaN(pkgs) && pkgs > 0;
    const validSize = !isNaN(size) && size > 0;
    const validCost = !isNaN(cost) && cost > 0;
    const totalQty = validPkgs && validSize ? pkgs * size : null;
    const totalCostCalc = validPkgs && validCost ? pkgs * cost : null;
    return {
      quantity: totalQty,
      totalCost: totalCostCalc,
      costPerUnit: totalQty && totalCostCalc ? totalCostCalc / totalQty : null,
    };
  })();

  function reset() {
    setQuantity('');
    setTotalCost('');
    setPackageCount('');
    setPackageSize('');
    setPackageCost('');
    setError(null);
  }

  async function handleSave() {
    if (!computed.quantity) {
      setError(mode === 'weight'
        ? 'Enter a valid quantity'
        : 'Enter package count and size');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await restockFeedItem({
        userId: user.id,
        feedInventoryId: item.id,
        quantityPurchased: computed.quantity,
        totalCost: computed.totalCost ?? undefined,
      });

      reset();
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

          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            {(['weight', 'package'] as RestockMode[]).map(m => (
              <Pressable
                key={m}
                style={[styles.modeOption, mode === m && styles.modeOptionActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.modeOptionText, mode === m && styles.modeOptionTextActive]}>
                  {m === 'weight' ? `By ${item.unit}` : 'By package'}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'weight' ? (
            <>
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
              </View>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Number of packages</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 5"
                  value={packageCount}
                  onChangeText={setPackageCount}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Size per package ({item.unit})</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 50"
                  value={packageSize}
                  onChangeText={setPackageSize}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Cost per package ($) <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 15.00"
                  value={packageCost}
                  onChangeText={setPackageCost}
                  keyboardType="decimal-pad"
                />
              </View>
            </>
          )}

          {/* Live preview */}
          {computed.quantity !== null && (
            <View style={styles.preview}>
              <Text style={styles.previewMain}>
                + {computed.quantity.toFixed(1)} {item.unit} added
                {computed.totalCost !== null && ` · $${computed.totalCost.toFixed(2)} total`}
              </Text>
              {computed.costPerUnit !== null && (
                <Text style={styles.previewSub}>
                  ${computed.costPerUnit.toFixed(2)} per {item.unit} — will update cost
                </Text>
              )}
            </View>
          )}

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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editLink: { paddingVertical: 4, paddingHorizontal: 4 },
  editLinkText: { fontSize: 15, fontWeight: '600', color: Colors.sage },
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
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.cream,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 10, overflow: 'hidden',
  },
  modeOption: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  modeOptionActive: { backgroundColor: Colors.sage },
  modeOptionText: { fontSize: 13, fontWeight: '700', color: Colors.charcoal, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 },
  modeOptionTextActive: { color: Colors.white, opacity: 1 },
  preview: {
    backgroundColor: '#EBF2EB',
    borderWidth: 1.5, borderColor: Colors.sage,
    borderRadius: 12, padding: 14, gap: 4,
  },
  previewMain: { fontSize: 15, fontWeight: '700', color: Colors.moss },
  previewSub: { fontSize: 13, color: Colors.moss, opacity: 0.8 },
  error: { color: Colors.rust, fontSize: 14 },
  saveButton: {
    backgroundColor: Colors.sage, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', minHeight: 56, justifyContent: 'center',
  },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
