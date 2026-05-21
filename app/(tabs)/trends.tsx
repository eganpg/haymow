import {
  StyleSheet, Text, View, ScrollView, Pressable,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import {
  getDailyYields, getSessionsInRange, yieldInUnit, DailyYield, MilkingSession,
} from '@/lib/queries/milking';
import { getDailyGrainLbs, getRecentFeedEntries, DailyFeedTotal } from '@/lib/queries/feed';
import { useYieldUnit } from '@/lib/preferences';

type Animal = { id: string; name: string; breed: string | null };
type Range = 7 | 30 | 90;

// Loose shape for raw feed_entries rows — we only need a handful of fields here,
// and the table is polymorphic so its TS type is broader than what we render.
// milking_session_id is the link added in migration 003; it lets the detail card
// group each session's feed inline underneath the session row.
// feed_inventory is the relational pull from getRecentFeedEntries — `name` is
// the specific product (e.g. "Purina Layena"); null for free-form entries.
type FeedEntry = {
  id: string;
  entry_time: string;
  feed_type: string | null;
  amount: number | null;
  unit: string | null;
  milking_session_id: string | null;
  feed_inventory: { name: string } | null;
};

const RANGES: Range[] = [7, 30, 90];

// YYYY-MM-DD key built from local Date components. Same rationale as the helpers
// in milking.ts / feed.ts / eggs.ts: avoid UTC bucketing so a 10pm session in
// CST doesn't slip into the next day. Inlined here because the trends screen
// re-buckets raw session/feed rows by date when the user taps a bar.
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function TrendsScreen() {
  const unit = useYieldUnit();
  const router = useRouter();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(7);
  const [showFeed, setShowFeed] = useState(false);
  const [yields, setYields] = useState<DailyYield[]>([]);
  const [feed, setFeed] = useState<DailyFeedTotal[]>([]);
  // Raw sessions and feed rows for the current range, kept in state so the detail
  // panel can be rendered instantly on bar-tap without re-querying. The lists are
  // small (≤ ~180 each for 90 days), so loading everything up-front is cheaper than
  // a network round trip per tap.
  const [sessions, setSessions] = useState<MilkingSession[]>([]);
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  // The day the user has drilled into. null means no panel is shown; tapping the
  // same bar again toggles it back to null. Reset whenever animal or range changes,
  // since a selected date wouldn't necessarily map to a meaningful bar after the
  // window shifts.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
    // Four queries in parallel: two aggregated (chart data) and two raw
    // (detail-panel data). Splitting them like this keeps the chart's daily
    // bucketing logic in the queries layer while still giving the screen
    // per-session and per-feed-entry rows for drill-down.
    const [y, f, s, fe] = await Promise.all([
      getDailyYields(id, r),
      getDailyGrainLbs(id, r),
      getSessionsInRange(id, r),
      getRecentFeedEntries({ animalId: id, days: r }),
    ]);
    setYields(y);
    setFeed(f);
    setSessions(s);
    setFeedEntries(fe as FeedEntry[]);
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
              <Pill
                key={a.id}
                label={a.name}
                active={a.id === animalId}
                onPress={() => {
                  // Clearing the selected day on filter changes keeps the detail
                  // panel from showing a date that no longer corresponds to the
                  // visible chart (different animal, or off the new range).
                  setSelectedDate(null);
                  setAnimalId(a.id);
                }}
              />
            ))}
          </View>
        )}

        <View style={styles.pillRow}>
          {RANGES.map(r => (
            <Pill
              key={r}
              label={`${r}d`}
              active={r === range}
              onPress={() => {
                setSelectedDate(null);
                setRange(r);
              }}
            />
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

          <BarChart
            data={yields}
            unit={unit}
            selectedDate={selectedDate}
            // Tap-the-same-bar-to-collapse is the lightweight way to dismiss the
            // panel without adding a close button — feels natural on mobile.
            onSelect={d => setSelectedDate(prev => (prev === d ? null : d))}
          />

          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>{formatShort(yields[0]?.date)}</Text>
            <Text style={styles.dateLabel}>Today</Text>
          </View>
        </View>

        {selectedDate && (
          <DayDetailCard
            date={selectedDate}
            unit={unit}
            sessions={sessions.filter(s => localDateKey(new Date(s.session_time)) === selectedDate)}
            feedEntries={feedEntries.filter(e => localDateKey(new Date(e.entry_time)) === selectedDate)}
            onClose={() => setSelectedDate(null)}
            onSessionPress={sessionId => {
              // Reuse the existing edit flow — log-milking is dual-purpose
              // (new session or edit if sessionId is provided). The selected
              // animal name is needed for the screen header.
              const currentAnimal = animals.find(a => a.id === animalId);
              router.push({
                pathname: '/log-milking',
                params: {
                  animalId: animalId ?? '',
                  animalName: currentAnimal?.name ?? '',
                  sessionId,
                },
              });
            }}
          />
        )}

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
            <FeedChart
              data={feed}
              selectedDate={selectedDate}
              onSelect={d => setSelectedDate(prev => (prev === d ? null : d))}
            />
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

// Yield bar chart. Each bar is a Pressable so tapping drills into that day.
// The selected bar swaps to Colors.moss (a darker sage) for a clear "you're
// looking at this one" affordance — chosen over a border because borders mess
// with the bar's height math at very small percentages.
function BarChart({
  data, unit, selectedDate, onSelect,
}: {
  data: DailyYield[];
  unit: 'gal' | 'lbs';
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const values = data.map(d => yieldInUnit(d.totalLbs, unit));
  const max = Math.max(1, ...values);
  return (
    <View style={styles.chart}>
      {data.map((d, i) => {
        const v = values[i];
        const heightPct = (v / max) * 100;
        const isEmpty = v === 0;
        const isSelected = d.date === selectedDate;
        // Empty days are still tappable — the detail panel will just show
        // "No sessions logged", which is useful for confirming a missed day.
        const fillColor = isSelected
          ? Colors.moss
          : isEmpty
            ? Colors.border
            : Colors.sage;
        return (
          <Pressable
            key={d.date}
            onPress={() => onSelect(d.date)}
            style={styles.barCell}
            hitSlop={4}
          >
            <View
              style={[
                styles.bar,
                {
                  height: `${isEmpty ? 1 : heightPct}%`,
                  backgroundColor: fillColor,
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function FeedChart({
  data, selectedDate, onSelect,
}: {
  data: DailyFeedTotal[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const max = Math.max(1, ...data.map(d => d.grainLbs));
  return (
    <View style={styles.feedChart}>
      {data.map(d => {
        const v = d.grainLbs;
        const heightPct = (v / max) * 100;
        const isEmpty = v === 0;
        const isSelected = d.date === selectedDate;
        // Selected uses charcoal so it stands out against the gold default —
        // moss would clash with the gold palette of the feed chart.
        const fillColor = isSelected
          ? Colors.charcoal
          : isEmpty
            ? Colors.border
            : Colors.gold;
        return (
          <Pressable
            key={d.date}
            onPress={() => onSelect(d.date)}
            style={styles.barCell}
            hitSlop={4}
          >
            <View
              style={[
                styles.bar,
                { height: `${isEmpty ? 1 : heightPct}%`, backgroundColor: fillColor },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

// Detail panel for a tapped day. Sessions are rendered as blocks: each block
// shows the session header (AM/PM, time, yield, notes) and inline beneath it
// the feed entries linked to that session via milking_session_id. Feed without
// a session link (pasture hours, ad-hoc grazing entries) falls into a separate
// "Other feed" section so it stays visible even though it isn't paired.
function DayDetailCard({
  date, unit, sessions, feedEntries, onClose, onSessionPress,
}: {
  date: string;
  unit: 'gal' | 'lbs';
  sessions: MilkingSession[];
  feedEntries: FeedEntry[];
  onClose: () => void;
  // Fired when the user taps a session block. The screen routes to the
  // log-milking edit screen with this id — same flow as the animal profile.
  onSessionPress: (sessionId: string) => void;
}) {
  const unitLabel = unit === 'lbs' ? 'lbs' : 'gal';
  const totalLbs = sessions.reduce((s, r) => s + Number(r.yield_lbs ?? 0), 0);
  const totalDisplay = yieldInUnit(totalLbs, unit);

  // Bucket feed entries by their linked session id. The map key is the
  // session id; orphans (no milking_session_id) accumulate under the
  // ORPHAN_KEY sentinel so we can render them separately at the bottom.
  const ORPHAN_KEY = '__orphan__';
  const feedBySession = new Map<string, FeedEntry[]>();
  for (const e of feedEntries) {
    const key = e.milking_session_id ?? ORPHAN_KEY;
    const arr = feedBySession.get(key) ?? [];
    arr.push(e);
    feedBySession.set(key, arr);
  }
  const orphanFeed = feedBySession.get(ORPHAN_KEY) ?? [];

  return (
    <View style={styles.detailCard}>
      <View style={styles.detailHeader}>
        <Text style={styles.detailTitle}>{formatLongDate(date)}</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.detailClose}>✕</Text>
        </Pressable>
      </View>

      <Text style={styles.detailTotal}>
        {totalDisplay.toFixed(1)} {unitLabel} · {sessions.length} session{sessions.length === 1 ? '' : 's'}
      </Text>

      <Text style={styles.detailSectionLabel}>Sessions</Text>
      {sessions.length === 0 ? (
        <Text style={styles.detailEmpty}>No sessions logged.</Text>
      ) : (
        <View style={styles.sessionBlockList}>
          {sessions.map(s => (
            <SessionBlock
              key={s.id}
              session={s}
              unit={unit}
              feed={feedBySession.get(s.id) ?? []}
              onPress={() => onSessionPress(s.id)}
            />
          ))}
        </View>
      )}

      {orphanFeed.length > 0 && (
        <>
          <Text style={styles.detailSectionLabel}>Other feed</Text>
          <View style={styles.detailList}>
            {orphanFeed.map(e => (
              <FeedLine key={e.id} entry={e} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// Single session + its associated feed entries inline. The feed list sits
// indented beneath the session header so the visual hierarchy reads as
// "this session, and what she ate for it." The whole block is Pressable —
// tapping opens the edit screen for that session, which is the path the
// user takes to fix or delete a stray record they spotted on the chart.
function SessionBlock({
  session, unit, feed, onPress,
}: {
  session: MilkingSession;
  unit: 'gal' | 'lbs';
  feed: FeedEntry[];
  onPress: () => void;
}) {
  const value = yieldInUnit(Number(session.yield_lbs ?? 0), unit).toFixed(1);
  const unitLabel = unit === 'lbs' ? 'lbs' : 'gal';
  const time = new Date(session.session_time).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
  const tags = session.health_tags ?? [];
  const estimated = session.is_estimated;
  // When estimated, italicize the yield AND prepend an "est." marker on the meta
  // line. Two cheap visual signals reinforce that this isn't measured data.
  const metaParts = [estimated ? 'est.' : null, ...tags, session.notes].filter(Boolean);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sessionBlock, pressed && styles.sessionBlockPressed]}
    >
      <View style={styles.sessionRow}>
        <View style={styles.sessionRowMain}>
          <Text style={styles.sessionType}>{session.session_type}</Text>
          <Text style={styles.sessionTime}>{time}</Text>
        </View>
        <View style={styles.sessionRowRight}>
          <View style={styles.sessionYieldRow}>
            <Text style={[styles.sessionYield, estimated && styles.sessionYieldEstimated]}>
              {value} {unitLabel}
            </Text>
            {/* Chevron mirrors the affordance on the animal-profile session
                rows, so the tap target reads as "open this." */}
            <Text style={styles.sessionChevron}>›</Text>
          </View>
          {metaParts.length > 0 && (
            <Text style={styles.sessionMeta} numberOfLines={1}>
              {metaParts.join(' · ')}
            </Text>
          )}
        </View>
      </View>
      {feed.length > 0 && (
        <View style={styles.sessionFeedList}>
          {feed.map(e => (
            <FeedLine key={e.id} entry={e} indented />
          ))}
        </View>
      )}
    </Pressable>
  );
}

// One feed entry as a label/value row. When the entry is linked to an inventory
// item, the product name is the primary label and the category (grain/hay/etc.)
// renders as a small caption beneath it — keeps the row visually tight while
// still surfacing both pieces of info. Entries without an inventory link
// (free-form/pasture) fall back to category-only.
// `indented` is used when the row is nested under a session.
function FeedLine({ entry, indented }: { entry: FeedEntry; indented?: boolean }) {
  const name = entry.feed_inventory?.name ?? null;
  const category = entry.feed_type ?? 'feed';
  // If there's no product name, treat the category as the primary label (no
  // caption underneath). With a name, show name on top + category caption.
  const primary = name ?? category;
  const caption = name ? category : null;
  return (
    <View style={[styles.detailRow, indented && styles.feedLineIndented]}>
      <View style={styles.feedLineTextCol}>
        <Text style={[styles.detailRowLabel, indented && styles.feedLineLabelIndented]} numberOfLines={1}>
          {primary}
        </Text>
        {caption && (
          <Text style={styles.feedLineCaption}>{caption}</Text>
        )}
      </View>
      <Text style={[styles.detailRowValue, indented && styles.feedLineValueIndented]}>
        {Number(entry.amount ?? 0).toFixed(1)} {entry.unit ?? ''}
      </Text>
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

// Long-form display for the detail header, e.g. "Sat, May 11".
// Parses the YYYY-MM-DD parts into a *local* Date — passing the string into
// new Date() would land at midnight UTC and shift back a day west of UTC
// (same bug we just fixed in flock-profile).
function formatLongDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
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

  detailCard: {
    backgroundColor: Colors.cream, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.border,
    padding: 20, gap: 10,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  detailTitle: { fontSize: 18, fontWeight: '800', color: Colors.charcoal },
  detailClose: {
    fontSize: 18, color: Colors.charcoal, opacity: 0.5, fontWeight: '600',
    paddingHorizontal: 4,
  },
  detailTotal: {
    fontSize: 14, color: Colors.charcoal, opacity: 0.6, fontWeight: '600',
    marginBottom: 4,
  },
  detailSectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.charcoal,
    opacity: 0.4, textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 4,
  },
  detailEmpty: {
    fontSize: 13, color: Colors.charcoal, opacity: 0.4, fontStyle: 'italic',
  },
  detailList: { gap: 8 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
  detailRowLabel: {
    fontSize: 14, color: Colors.charcoal, fontWeight: '500',
    textTransform: 'capitalize',
  },
  detailRowValue: { fontSize: 14, fontWeight: '700', color: Colors.charcoal },

  sessionBlockList: { gap: 14 },
  sessionBlock: {
    gap: 6,
    // Small horizontal pad so the pressed-state highlight has room to breathe
    // without making the block feel like a separate card.
    paddingHorizontal: 6, paddingVertical: 4, marginHorizontal: -6,
    borderRadius: 8,
  },
  sessionBlockPressed: { backgroundColor: Colors.linen },
  sessionFeedList: {
    gap: 2, paddingLeft: 12, marginLeft: 4,
    borderLeftWidth: 2, borderLeftColor: Colors.border,
    paddingVertical: 4,
  },
  feedLineIndented: { paddingVertical: 2, alignItems: 'flex-start' },
  feedLineTextCol: { flex: 1, paddingRight: 8 },
  feedLineLabelIndented: {
    fontSize: 13, opacity: 0.85,
  },
  feedLineValueIndented: { fontSize: 13, fontWeight: '600' },
  // The category caption sits under the product name. Small, dim, and not
  // italicized so it reads as a label, not editorial.
  feedLineCaption: {
    fontSize: 11, color: Colors.charcoal, opacity: 0.45, fontWeight: '500',
    textTransform: 'capitalize', marginTop: 1,
  },

  sessionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 6,
  },
  sessionRowMain: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  sessionRowRight: { alignItems: 'flex-end', maxWidth: '60%' },
  sessionType: {
    fontSize: 13, fontWeight: '800', color: Colors.sage,
    backgroundColor: Colors.linen,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    minWidth: 28, textAlign: 'center',
  },
  sessionTime: { fontSize: 13, color: Colors.charcoal, opacity: 0.55 },
  sessionYieldRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionYield: { fontSize: 15, fontWeight: '800', color: Colors.charcoal },
  // Estimated sessions read as a guess, not a measurement — italicize and
  // soften the color so the eye can sort real-data rows from filled-in ones.
  sessionYieldEstimated: {
    fontStyle: 'italic', color: Colors.charcoal, opacity: 0.6, fontWeight: '700',
  },
  sessionChevron: {
    fontSize: 20, color: Colors.charcoal, opacity: 0.3, fontWeight: '600',
    lineHeight: 20,
  },
  sessionMeta: { fontSize: 11, color: Colors.charcoal, opacity: 0.5, marginTop: 2 },
});
