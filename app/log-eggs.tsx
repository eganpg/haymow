import {
  StyleSheet, Text, View, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Colors } from '@/constants/Colors';
import { logEggCollection } from '@/lib/queries/eggs';
import { logFeedUsage, getFeedInventory, FeedInventoryItem } from '@/lib/queries/feedInventory';
import { supabase } from '@/lib/supabase';
import { DateField, todayLocalKey } from '@/components/DateField';

type FeedEntry = {
  id: string;
  feedInventoryId: string | null;
  amount: string;
};

const LAYER_FEED_TYPES = ['layer-pellet', 'scratch', 'oyster-shell', 'other'];

let entryCounter = 0;
function newEntry(): FeedEntry {
  return { id: String(entryCounter++), feedInventoryId: null, amount: '' };
}

// Human-friendly label for the collapsed Date row. Shows "Today" / "Yesterday"
// for the common cases, falls back to "Mon, May 11" for older backfills so the
// row reads at a glance without needing the full numeric date.
function formatCollectionDate(yyyymmdd: string): string {
  const today = todayLocalKey();
  if (yyyymmdd === today) return 'Today';
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  // Build the date in local time to avoid the UTC-midnight-shifts-a-day pitfall.
  const picked = new Date(y, m - 1, d);
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  if (picked.getTime() === yesterday.getTime()) return 'Yesterday';
  return picked.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Build an ISO timestamp at noon local on the given date. Used for the
// linked feed_entries.entry_time when the user backdates a collection — noon
// is unambiguous (no day-boundary edge cases) and keeps the feed row in the
// same local-date bucket as the egg collection it was logged with.
function noonLocalISO(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

export default function LogEggsScreen() {
  const { flockId, flockName } = useLocalSearchParams<{ flockId: string; flockName: string }>();
  const router = useRouter();

  const [eggCount, setEggCount] = useState('');
  const [brokenCount, setBrokenCount] = useState('');
  const [softShellCount, setSoftShellCount] = useState('');
  const [notes, setNotes] = useState('');
  const [collectionDate, setCollectionDate] = useState<string>(() => todayLocalKey());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feed
  const [showFeed, setShowFeed] = useState(false);
  const [feedInventory, setFeedInventory] = useState<FeedInventoryItem[]>([]);
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([newEntry()]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      getFeedInventory(user.id).then(items => {
        setFeedInventory(items.filter(i => LAYER_FEED_TYPES.includes(i.feed_type)));
      });
    });
  }, []);

  function addFeedEntry() {
    setFeedEntries(prev => [...prev, newEntry()]);
  }

  function removeFeedEntry(id: string) {
    setFeedEntries(prev => prev.filter(e => e.id !== id));
  }

  function updateFeedEntry(id: string, patch: Partial<FeedEntry>) {
    setFeedEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  async function handleSave() {
    const eggs = parseInt(eggCount, 10);
    if (isNaN(eggs) || eggs < 0) {
      setError('Enter a valid egg count');
      return;
    }

    const validFeedEntries = showFeed
      ? feedEntries.filter(e => e.feedInventoryId && e.amount && !isNaN(parseFloat(e.amount)))
      : [];

    const incompleteEntry = showFeed && feedEntries.some(
      e => (e.feedInventoryId && (!e.amount || isNaN(parseFloat(e.amount)))) ||
           (!e.feedInventoryId && e.amount)
    );
    if (incompleteEntry) {
      setError('Each feed entry needs both a feed selection and an amount');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await logEggCollection({
        flockId,
        userId: user.id,
        eggCount: eggs,
        brokenCount: parseInt(brokenCount, 10) || 0,
        softShellCount: parseInt(softShellCount, 10) || 0,
        notes: notes.trim() || undefined,
        collectionDate,
      });

      // Stamp linked feed entries at noon on the picked date so they sit in
      // the same local-date bucket as the egg row (matters for any future
      // feed-cost-per-dozen rollup that buckets by day).
      const feedEntryTime = collectionDate === todayLocalKey()
        ? undefined
        : noonLocalISO(collectionDate);

      await Promise.all(
        validFeedEntries.map(e =>
          logFeedUsage({
            userId: user.id,
            feedInventoryId: e.feedInventoryId!,
            flockId,
            amount: parseFloat(e.amount),
            entryTime: feedEntryTime,
          })
        )
      );

      router.back();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Log eggs</Text>
          <Text style={styles.subtitle}>{flockName}</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Date. Mirrors the dairy "Logged at" pattern: collapsed row that
            shows the picked date and a Change link; expands to a date picker
            so the user can backfill a forgotten collection. Date-only (no
            time) because egg_collections.collection_date is a DATE column —
            time-of-day doesn't matter for the daily-total rollup. */}
        <View style={styles.section}>
          {!showDatePicker ? (
            <Pressable style={styles.timeRow} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.timeRowLabel}>Date</Text>
              <View style={styles.timeRowRight}>
                <Text style={styles.timeRowValue}>{formatCollectionDate(collectionDate)}</Text>
                <Text style={styles.timeRowChange}>Change</Text>
              </View>
            </Pressable>
          ) : (
            <View style={styles.timePickerBlock}>
              <Text style={styles.label}>Date</Text>
              <DateField
                value={collectionDate}
                onChange={setCollectionDate}
                onError={setError}
              />
              <Pressable
                style={styles.timePickerDone}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.timePickerDoneText}>Done</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Eggs collected</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 10"
            value={eggCount}
            onChangeText={setEggCount}
            keyboardType="number-pad"
            autoFocus
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.label}>Broken <Text style={styles.dim}>(opt)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={brokenCount}
              onChangeText={setBrokenCount}
              keyboardType="number-pad"
            />
          </View>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.label}>Soft shell <Text style={styles.dim}>(opt)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={softShellCount}
              onChangeText={setSoftShellCount}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Feed */}
        <View style={styles.section}>
          <Pressable style={styles.feedToggleRow} onPress={() => setShowFeed(v => !v)}>
            <Text style={styles.feedToggleText}>{showFeed ? '− Remove feed' : '+ Log feed given'}</Text>
          </Pressable>

          {showFeed && (
            <View style={styles.feedBlock}>
              {feedInventory.length === 0 ? (
                <Pressable onPress={() => router.push('/feed-management')}>
                  <Text style={styles.noFeedText}>No feed in inventory. Tap to set up feed →</Text>
                </Pressable>
              ) : (
                <>
                  {feedEntries.map((entry, idx) => (
                    <FeedEntryRow
                      key={entry.id}
                      entry={entry}
                      index={idx}
                      inventory={feedInventory}
                      canRemove={feedEntries.length > 1}
                      onChange={(patch) => updateFeedEntry(entry.id, patch)}
                      onRemove={() => removeFeedEntry(entry.id)}
                    />
                  ))}

                  <Pressable style={styles.addFeedRow} onPress={addFeedEntry}>
                    <Text style={styles.addFeedText}>+ Add another feed</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Notes <Text style={styles.dim}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Anything worth noting..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.saveButtonText}>Save</Text>
            }
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FeedEntryRow({ entry, index, inventory, canRemove, onChange, onRemove }: {
  entry: FeedEntry;
  index: number;
  inventory: FeedInventoryItem[];
  canRemove: boolean;
  onChange: (patch: Partial<FeedEntry>) => void;
  onRemove: () => void;
}) {
  const selected = inventory.find(f => f.id === entry.feedInventoryId) ?? null;
  const costPreview = selected?.cost_per_unit && entry.amount && !isNaN(parseFloat(entry.amount))
    ? (selected.cost_per_unit * parseFloat(entry.amount)).toFixed(2)
    : null;

  return (
    <View style={styles.feedEntryBlock}>
      <View style={styles.feedEntryHeader}>
        <Text style={styles.feedEntryLabel}>Feed {index + 1}</Text>
        {canRemove && (
          <Pressable onPress={onRemove}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.feedPickerList}>
        {inventory.map(f => (
          <Pressable
            key={f.id}
            style={[styles.feedOption, entry.feedInventoryId === f.id && styles.feedOptionActive]}
            onPress={() => onChange({ feedInventoryId: f.id })}
          >
            <View style={styles.feedOptionLeft}>
              <Text style={[styles.feedOptionName, entry.feedInventoryId === f.id && styles.feedOptionNameActive]}>
                {f.name}
              </Text>
              <Text style={styles.feedOptionStock}>
                {f.quantity_on_hand.toFixed(1)} {f.unit} on hand
                {f.cost_per_unit ? ` · $${f.cost_per_unit.toFixed(2)}/${f.unit}` : ''}
              </Text>
            </View>
            {entry.feedInventoryId === f.id && <Text style={styles.checkmark}>✓</Text>}
          </Pressable>
        ))}
      </View>

      {entry.feedInventoryId && (
        <View style={styles.amountRow}>
          <TextInput
            style={[styles.input, styles.amountInput]}
            placeholder={`Amount (${selected?.unit ?? 'unit'})`}
            value={entry.amount}
            onChangeText={(v) => onChange({ amount: v })}
            keyboardType="decimal-pad"
          />
          {costPreview && (
            <Text style={styles.costPreview}>Cost: ${costPreview}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.linen },
  content: { padding: 24, gap: 28, paddingBottom: 48 },
  header: { gap: 4, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.charcoal, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: Colors.charcoal, opacity: 0.5, fontWeight: '500' },
  section: { gap: 10 },
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 15, fontWeight: '600', color: Colors.charcoal },
  dim: { fontWeight: '400', opacity: 0.5 },
  input: {
    backgroundColor: Colors.cream, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 18, color: Colors.charcoal, minHeight: 52,
  },
  notesInput: { fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.cream, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52,
  },
  timeRowLabel: { fontSize: 15, fontWeight: '600', color: Colors.charcoal },
  timeRowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeRowValue: { fontSize: 15, color: Colors.charcoal, opacity: 0.65, fontWeight: '500' },
  timeRowChange: { fontSize: 14, color: Colors.sage, fontWeight: '700' },
  timePickerBlock: { gap: 10 },
  timePickerDone: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12 },
  timePickerDoneText: { fontSize: 14, fontWeight: '700', color: Colors.sage },
  feedToggleRow: { paddingVertical: 4 },
  feedToggleText: { fontSize: 15, fontWeight: '600', color: Colors.sage },
  feedBlock: {
    backgroundColor: Colors.cream, borderRadius: 14, borderWidth: 1.5,
    borderColor: Colors.border, padding: 16, gap: 16,
  },
  noFeedText: { fontSize: 14, color: Colors.sage, fontWeight: '600' },
  feedEntryBlock: {
    gap: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  feedEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feedEntryLabel: { fontSize: 13, fontWeight: '700', color: Colors.charcoal, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 },
  removeText: { fontSize: 13, fontWeight: '600', color: Colors.rust },
  feedPickerList: { gap: 6 },
  feedOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.linen,
  },
  feedOptionActive: { borderColor: Colors.sage, backgroundColor: '#EBF2EB' },
  feedOptionLeft: { gap: 2, flex: 1 },
  feedOptionName: { fontSize: 15, fontWeight: '700', color: Colors.charcoal },
  feedOptionNameActive: { color: Colors.moss },
  feedOptionStock: { fontSize: 12, color: Colors.charcoal, opacity: 0.5 },
  checkmark: { fontSize: 16, color: Colors.sage, fontWeight: '700' },
  amountRow: { gap: 6 },
  amountInput: { fontSize: 16 },
  costPreview: { fontSize: 13, color: Colors.sage, fontWeight: '600', paddingLeft: 4 },
  addFeedRow: { paddingTop: 4 },
  addFeedText: { fontSize: 14, fontWeight: '600', color: Colors.sage },
  error: { color: Colors.rust, fontSize: 14 },
  actions: { gap: 12 },
  saveButton: {
    backgroundColor: Colors.sage, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', minHeight: 56, justifyContent: 'center',
  },
  saveButtonPressed: { opacity: 0.8 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  cancelButton: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15, color: Colors.charcoal, opacity: 0.5, fontWeight: '500' },
});
