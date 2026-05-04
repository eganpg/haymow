import {
  StyleSheet, Text, View, Pressable, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { createFeedItem } from '@/lib/queries/feedInventory';

type FeedCategory = 'dairy' | 'layers' | 'meat_birds' | 'other';

const CATEGORIES: { value: FeedCategory; label: string }[] = [
  { value: 'dairy',      label: 'Dairy' },
  { value: 'layers',     label: 'Layers' },
  { value: 'meat_birds', label: 'Meat Birds' },
  { value: 'other',      label: 'Other' },
];

const FEED_TYPES: Record<FeedCategory, { value: string; label: string }[]> = {
  dairy:      [
    { value: 'grain',   label: 'Grain' },
    { value: 'hay',     label: 'Hay' },
    { value: 'mineral', label: 'Mineral' },
    { value: 'pasture', label: 'Pasture' },
    { value: 'other',   label: 'Other' },
  ],
  layers:     [
    { value: 'layer-pellet',  label: 'Layer pellet' },
    { value: 'scratch',       label: 'Scratch' },
    { value: 'oyster-shell',  label: 'Oyster shell' },
    { value: 'other',         label: 'Other' },
  ],
  meat_birds: [
    { value: 'chick-starter', label: 'Chick starter' },
    { value: 'grower',        label: 'Grower' },
    { value: 'finisher',      label: 'Finisher' },
    { value: 'other',         label: 'Other' },
  ],
  other:      [{ value: 'other', label: 'Other' }],
};

const UNITS = ['lbs', 'bags', 'flakes', 'oz'];

export default function AddFeedItemScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FeedCategory>('dairy');
  const [feedType, setFeedType] = useState('grain');
  const [unit, setUnit] = useState('lbs');
  const [quantityOnHand, setQuantityOnHand] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [lowStockAlert, setLowStockAlert] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCategoryChange(c: FeedCategory) {
    setCategory(c);
    setFeedType(FEED_TYPES[c][0].value);
  }

  const costPerUnit = quantityOnHand && totalCost
    ? (parseFloat(totalCost) / parseFloat(quantityOnHand)).toFixed(4)
    : null;

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    const qty = parseFloat(quantityOnHand);
    if (quantityOnHand && isNaN(qty)) { setError('Enter a valid quantity'); return; }

    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await createFeedItem({
        userId: user.id,
        name: name.trim(),
        feedType,
        unit,
        quantityOnHand: qty || 0,
        costPerUnit: costPerUnit ? parseFloat(costPerUnit) : undefined,
        lowStockAlert: lowStockAlert ? parseFloat(lowStockAlert) : undefined,
      });

      router.back();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Add feed</Text>

        {/* Name */}
        <Field label="Name" required hint="e.g. Purina Strategy, Coastal hay, Nutrena layer pellets">
          <TextInput
            style={styles.input}
            placeholder="Feed name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
          />
        </Field>

        {/* Category */}
        <Field label="Used for">
          <View style={styles.segmented}>
            {CATEGORIES.map(c => (
              <Pressable
                key={c.value}
                style={[styles.segment, category === c.value && styles.segmentActive]}
                onPress={() => handleCategoryChange(c.value)}
              >
                <Text style={[styles.segmentText, category === c.value && styles.segmentTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {/* Feed type */}
        <Field label="Feed type">
          <View style={styles.chips}>
            {FEED_TYPES[category].map(ft => (
              <Pressable
                key={ft.value}
                style={[styles.chip, feedType === ft.value && styles.chipActive]}
                onPress={() => setFeedType(ft.value)}
              >
                <Text style={[styles.chipText, feedType === ft.value && styles.chipTextActive]}>
                  {ft.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {/* Unit */}
        <Field label="Measured in">
          <View style={styles.chips}>
            {UNITS.map(u => (
              <Pressable
                key={u}
                style={[styles.chip, unit === u && styles.chipActive]}
                onPress={() => setUnit(u)}
              >
                <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {/* Current stock */}
        <Field label={`How much do you have on hand? (${unit})`}>
          <TextInput
            style={styles.input}
            placeholder="e.g. 50"
            value={quantityOnHand}
            onChangeText={setQuantityOnHand}
            keyboardType="decimal-pad"
          />
        </Field>

        {/* Cost */}
        <Field label="What did you pay? ($)" hint="Total cost for the quantity above — cost per unit is calculated automatically">
          <TextInput
            style={styles.input}
            placeholder="e.g. 22.50"
            value={totalCost}
            onChangeText={setTotalCost}
            keyboardType="decimal-pad"
          />
          {costPerUnit && (
            <Text style={styles.costCalc}>${costPerUnit} per {unit}</Text>
          )}
        </Field>

        {/* Low stock alert */}
        <Field label={`Low stock alert (${unit})`} hint="Get a warning when quantity falls below this">
          <TextInput
            style={styles.input}
            placeholder={`e.g. ${unit === 'lbs' ? '10' : '1'}`}
            value={lowStockAlert}
            onChangeText={setLowStockAlert}
            keyboardType="decimal-pad"
          />
        </Field>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.8 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveButtonText}>Save</Text>
          }
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.linen },
  content: { padding: 24, gap: 24, paddingBottom: 48 },
  backButton: { marginBottom: 4 },
  backText: { fontSize: 16, color: Colors.sage, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.charcoal, letterSpacing: -0.5 },
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: '600', color: Colors.charcoal },
  required: { color: Colors.rust },
  hint: { fontSize: 13, color: Colors.charcoal, opacity: 0.5, lineHeight: 18 },
  segmented: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  segment: {
    flex: 1, minWidth: 70, backgroundColor: Colors.cream, borderWidth: 1.5,
    borderColor: Colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  segmentActive: { backgroundColor: Colors.sage, borderColor: Colors.sage },
  segmentText: { fontSize: 13, fontWeight: '600', color: Colors.charcoal },
  segmentTextActive: { color: Colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Colors.cream, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipActive: { backgroundColor: Colors.sage, borderColor: Colors.sage },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.charcoal, opacity: 0.65 },
  chipTextActive: { color: Colors.white, opacity: 1 },
  input: {
    backgroundColor: Colors.cream, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: Colors.charcoal, minHeight: 52,
  },
  costCalc: { fontSize: 13, color: Colors.sage, fontWeight: '600', paddingLeft: 4 },
  error: { color: Colors.rust, fontSize: 14 },
  saveButton: {
    backgroundColor: Colors.sage, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', minHeight: 56, justifyContent: 'center', marginTop: 8,
  },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
