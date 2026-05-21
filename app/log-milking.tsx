import {
  StyleSheet, Text, View, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Colors } from '@/constants/Colors';
import {
  logMilkingSession, getMilkingSession, updateMilkingSession, deleteMilkingSession,
  yieldInUnit,
} from '@/lib/queries/milking';
import {
  logFeedUsage, getFeedInventory, getFeedEntriesForSession, FeedInventoryItem,
} from '@/lib/queries/feedInventory';
import { supabase } from '@/lib/supabase';
import { useYieldUnit, setYieldUnitPref, initYieldUnit, YieldUnit } from '@/lib/preferences';
import { DateTimeField } from '@/components/DateTimeField';

type SessionType = 'AM' | 'PM' | 'single';

type FeedEntry = {
  id: string; // local key
  feedInventoryId: string | null;
  amount: string;
};

// Free-form chip tags for the session. Stored as text[] in milking_sessions.health_tags.
// Mix of health concerns (mastitis, off-feed, limping) and event tags (spilled).
// "estimated" is intentionally NOT here — it has its own boolean column because it
// describes the record itself, not something observed during milking. See migration 006.
const SESSION_TAGS = ['mastitis-concern', 'off-feed', 'limping', 'unusual-behavior', 'spilled'];
const DAIRY_FEED_TYPES = ['grain', 'hay', 'mineral', 'pasture', 'other'];

let entryCounter = 0;
function newEntry(): FeedEntry {
  return { id: String(entryCounter++), feedInventoryId: null, amount: '' };
}

function formatSessionTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function LogMilkingScreen() {
  const { animalId, animalName, sessionId } = useLocalSearchParams<{
    animalId: string;
    animalName: string;
    sessionId?: string;
  }>();
  const router = useRouter();
  const isEdit = !!sessionId;

  const hour = new Date().getHours();
  const defaultSession: SessionType = hour < 12 ? 'AM' : 'PM';

  const yieldUnit = useYieldUnit();
  const [sessionType, setSessionType] = useState<SessionType>(defaultSession);
  const [yieldInput, setYieldInput] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isEstimated, setIsEstimated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(isEdit);
  const [sessionTime, setSessionTime] = useState<string>(() => new Date().toISOString());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Feed
  const [showFeed, setShowFeed] = useState(false);
  const [feedInventory, setFeedInventory] = useState<FeedInventoryItem[]>([]);
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([newEntry()]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      getFeedInventory(user.id).then(items => {
        setFeedInventory(items.filter(i => DAIRY_FEED_TYPES.includes(i.feed_type)));
      });
    });
  }, []);

  // Prefill in edit mode. Run once on mount; reactivity to later yieldUnit
  // changes is intentionally skipped — matches create-mode behavior.
  useEffect(() => {
    if (!isEdit || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const [session, linkedFeed, prefUnit] = await Promise.all([
          getMilkingSession(sessionId),
          getFeedEntriesForSession(sessionId),
          initYieldUnit(),
        ]);
        if (cancelled || !session) return;

        setSessionType(session.session_type);
        setSessionTime(session.session_time);
        const displayYield = yieldInUnit(session.yield_lbs, prefUnit);
        setYieldInput(displayYield.toFixed(2).replace(/\.?0+$/, ''));
        setNotes(session.notes ?? '');
        setSelectedTags(session.health_tags ?? []);
        setIsEstimated(session.is_estimated ?? false);

        if (linkedFeed.length > 0) {
          setShowFeed(true);
          setFeedEntries(linkedFeed.map(f => ({
            id: String(entryCounter++),
            feedInventoryId: f.feed_inventory_id,
            amount: String(f.amount),
          })));
        }
      } catch (e: any) {
        setError(e.message ?? 'Could not load session.');
      } finally {
        if (!cancelled) setPrefillLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function addFeedEntry() {
    setFeedEntries(prev => [...prev, newEntry()]);
  }

  function removeFeedEntry(id: string) {
    setFeedEntries(prev => prev.filter(e => e.id !== id));
  }

  function updateFeedEntry(id: string, patch: Partial<FeedEntry>) {
    setFeedEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  async function handleSave() {
    const value = parseFloat(yieldInput);
    if (isNaN(value) || value <= 0) {
      setError(`Enter a valid yield (${yieldUnit === 'lbs' ? 'lbs' : 'gallons'})`);
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

      const feedPayload = validFeedEntries.map(e => ({
        feedInventoryId: e.feedInventoryId!,
        amount: parseFloat(e.amount),
      }));

      if (isEdit && sessionId) {
        await updateMilkingSession({
          sessionId,
          userId: user.id,
          animalId,
          sessionType,
          yieldValue: value,
          yieldUnit,
          sessionTime,
          notes: notes.trim() || undefined,
          healthTags: selectedTags,
          isEstimated,
          feedEntries: feedPayload,
        });
      } else {
        const created = await logMilkingSession({
          animalId,
          userId: user.id,
          sessionType,
          yieldValue: value,
          yieldUnit,
          sessionTime,
          notes: notes.trim() || undefined,
          healthTags: selectedTags,
          isEstimated,
        });

        for (const e of feedPayload) {
          await logFeedUsage({
            userId: user.id,
            feedInventoryId: e.feedInventoryId,
            animalId,
            milkingSessionId: created.id,
            amount: e.amount,
            entryTime: sessionTime,
          });
        }
      }

      router.back();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleDeletePress() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
      return;
    }
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    runDelete();
  }

  async function runDelete() {
    if (!sessionId) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteMilkingSession(sessionId);
      router.back();
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete. Try again.');
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  if (prefillLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.sage} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{isEdit ? 'Edit session' : 'Log session'}</Text>
          <Text style={styles.subtitle}>{animalName}</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Logged at */}
        <View style={styles.section}>
          {!showTimePicker ? (
            <Pressable style={styles.timeRow} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.timeRowLabel}>Logged at</Text>
              <View style={styles.timeRowRight}>
                <Text style={styles.timeRowValue}>{formatSessionTimestamp(sessionTime)}</Text>
                <Text style={styles.timeRowChange}>Change</Text>
              </View>
            </Pressable>
          ) : (
            <View style={styles.timePickerBlock}>
              <Text style={styles.label}>Logged at</Text>
              <DateTimeField
                value={sessionTime}
                onChange={setSessionTime}
                onError={setError}
              />
              <Pressable
                style={styles.timePickerDone}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.timePickerDoneText}>Done</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Session type */}
        <View style={styles.section}>
          <Text style={styles.label}>Session</Text>
          <View style={styles.segmented}>
            {(['AM', 'PM', 'single'] as SessionType[]).map((s) => (
              <Pressable
                key={s}
                style={[styles.segment, sessionType === s && styles.segmentActive]}
                onPress={() => setSessionType(s)}
              >
                <Text style={[styles.segmentText, sessionType === s && styles.segmentTextActive]}>
                  {s === 'single' ? 'Once' : s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Yield */}
        <View style={styles.section}>
          <View style={styles.yieldHeader}>
            <Text style={styles.label}>Yield</Text>
            <View style={styles.unitToggle}>
              {(['gal', 'lbs'] as YieldUnit[]).map(u => (
                <Pressable
                  key={u}
                  style={[styles.unitOption, yieldUnit === u && styles.unitOptionActive]}
                  onPress={() => setYieldUnitPref(u)}
                >
                  <Text style={[styles.unitOptionText, yieldUnit === u && styles.unitOptionTextActive]}>
                    {u}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <TextInput
            style={styles.input}
            placeholder={yieldUnit === 'lbs' ? 'e.g. 27.5' : 'e.g. 3.2'}
            value={yieldInput}
            onChangeText={setYieldInput}
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>

        {/* Estimated. Sits directly under Yield because that's the value being
            flagged as a guess. Stored in its own column (not the chip tags) so
            analytics can cleanly exclude or down-weight these. */}
        <View style={styles.section}>
          <Pressable
            style={styles.estimatedRow}
            onPress={() => setIsEstimated(v => !v)}
          >
            <View style={styles.estimatedTextCol}>
              <Text style={styles.label}>Mark as estimated</Text>
              <Text style={styles.estimatedHint}>For when you forgot to log in the moment.</Text>
            </View>
            <Switch
              value={isEstimated}
              onValueChange={setIsEstimated}
              trackColor={{ false: Colors.border, true: Colors.sage }}
              thumbColor={Colors.white}
            />
          </Pressable>
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

        {/* Tags — health concerns and event flags (spilled, etc.). Free-form
            text[] in DB, so adding to SESSION_TAGS is the only change needed. */}
        <View style={styles.section}>
          <Text style={styles.label}>Tags <Text style={styles.dim}>(optional)</Text></Text>
          <View style={styles.tags}>
            {SESSION_TAGS.map(tag => (
              <Pressable
                key={tag}
                style={[styles.chip, selectedTags.includes(tag) && styles.chipRust]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.chipText, selectedTags.includes(tag) && styles.chipTextRust]}>
                  {tag.replace(/-/g, ' ')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Notes */}
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
            disabled={loading || deleting}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.saveButtonText}>{isEdit ? 'Update session' : 'Save session'}</Text>
            }
          </Pressable>
          {isEdit && (
            <Pressable
              style={({ pressed }) => [
                styles.deleteButton,
                confirmingDelete && styles.deleteButtonConfirming,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleDeletePress}
              disabled={loading || deleting}
            >
              {deleting
                ? <ActivityIndicator color={Colors.rust} />
                : (
                  <Text style={styles.deleteButtonText}>
                    {confirmingDelete ? 'Tap again to confirm delete' : 'Delete session'}
                  </Text>
                )
              }
            </Pressable>
          )}
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

      {/* Feed picker */}
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

      {/* Amount */}
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
  label: { fontSize: 15, fontWeight: '600', color: Colors.charcoal },
  dim: { fontWeight: '400', opacity: 0.5 },
  segmented: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1, backgroundColor: Colors.cream, borderWidth: 1.5,
    borderColor: Colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  segmentActive: { backgroundColor: Colors.sage, borderColor: Colors.sage },
  segmentText: { fontSize: 15, fontWeight: '600', color: Colors.charcoal },
  segmentTextActive: { color: Colors.white },
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
  yieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.cream,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  unitOption: { paddingHorizontal: 14, paddingVertical: 6, minWidth: 48, alignItems: 'center' },
  unitOptionActive: { backgroundColor: Colors.sage },
  unitOptionText: { fontSize: 13, fontWeight: '700', color: Colors.charcoal, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 },
  unitOptionTextActive: { color: Colors.white, opacity: 1 },
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
  estimatedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.cream, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52,
    gap: 16,
  },
  estimatedTextCol: { flex: 1, gap: 2 },
  estimatedHint: { fontSize: 13, color: Colors.charcoal, opacity: 0.55 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Colors.cream, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  chipRust: { backgroundColor: '#FDF0EB', borderColor: Colors.rust },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.charcoal, opacity: 0.6 },
  chipTextRust: { color: Colors.rust, opacity: 1 },
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
  deleteButton: {
    borderWidth: 1.5, borderColor: Colors.rust, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', minHeight: 52, justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  deleteButtonConfirming: { backgroundColor: '#FDF0EB' },
  deleteButtonText: { fontSize: 15, fontWeight: '700', color: Colors.rust },
});
