import {
  StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator,
  TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Colors } from '@/constants/Colors';
import { AnimalType, DairySpecies, createDairyAnimal, createFlock, createMeatBirdBatch } from '@/lib/queries/animals';
import { supabase } from '@/lib/supabase';
import { MEAT_BIRDS_ENABLED } from '@/lib/features';

const TYPES: { type: AnimalType; emoji: string; label: string }[] = [
  { type: 'dairy',      emoji: '🐄', label: 'Dairy Animal' },
  { type: 'layers',     emoji: '🥚', label: 'Layer Flock' },
  { type: 'meat_birds', emoji: '🐔', label: 'Meat Bird Batch' },
];

const VISIBLE_TYPES = TYPES.filter(t => t.type !== 'meat_birds' || MEAT_BIRDS_ENABLED);

// Species + per-species breed presets for the dairy picker. Keeping the breed
// segments species-aware (Jersey for cows, Nubian/Alpine for goats, etc.) means
// one tap covers the common case; uncommon breeds fall back to "Other".
const DAIRY_SPECIES: { value: DairySpecies; label: string }[] = [
  { value: 'cow',   label: 'Cow' },
  { value: 'goat',  label: 'Goat' },
  { value: 'sheep', label: 'Sheep' },
];

const BREED_OPTIONS: Record<DairySpecies, string[]> = {
  cow:   ['Jersey', 'Other'],
  goat:  ['Nubian', 'Alpine', 'Other'],
  sheep: ['East Friesian', 'Other'],
};

export default function AddAnimalScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'pick' | 'setup'>('pick');
  const [type, setType] = useState<AnimalType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dairy
  const [animalName, setAnimalName] = useState('');
  const [species, setSpecies] = useState<DairySpecies>('cow');
  const [breed, setBreed] = useState('Jersey');
  const [fresheningDate, setFresheningDate] = useState('');

  // Layers
  const [flockName, setFlockName] = useState('');
  const [henCount, setHenCount] = useState('');
  const [intakeDate, setIntakeDate] = useState('');

  // Meat birds
  const [meatBreed, setMeatBreed] = useState('Cornish Cross');
  const [chickCount, setChickCount] = useState('');
  const [chickIntakeDate, setChickIntakeDate] = useState('');

  function handlePickType(t: AnimalType) {
    setType(t);
    setStep('setup');
  }

  async function handleSave() {
    setError(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (type === 'dairy') {
        if (!animalName.trim()) throw new Error('Name is required');
        if (!fresheningDate.trim()) throw new Error('Freshening date is required');
        await createDairyAnimal(user.id, { name: animalName.trim(), species, breed, fresheningDate });
      } else if (type === 'layers') {
        if (!flockName.trim()) throw new Error('Flock name is required');
        if (!henCount.trim() || isNaN(Number(henCount))) throw new Error('Hen count is required');
        if (!intakeDate.trim()) throw new Error('Start date is required');
        await createFlock(user.id, { name: flockName.trim(), henCount: Number(henCount), intakeDate });
      } else if (type === 'meat_birds') {
        if (!chickCount.trim() || isNaN(Number(chickCount))) throw new Error('Chick count is required');
        if (!chickIntakeDate.trim()) throw new Error('Arrival date is required');
        await createMeatBirdBatch(user.id, { breed: meatBreed, chickCount: Number(chickCount), intakeDate: chickIntakeDate });
      }

      router.back();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'pick') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Cancel</Text>
        </Pressable>
        <Text style={styles.title}>What are you adding?</Text>
        <View style={styles.cards}>
          {VISIBLE_TYPES.map(({ type: t, emoji, label }) => (
            <Pressable
              key={t}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => handlePickType(t)}
            >
              <Text style={styles.cardEmoji}>{emoji}</Text>
              <Text style={styles.cardLabel}>{label}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setStep('pick')} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>
          {type === 'dairy' ? 'New dairy animal' : type === 'layers' ? 'New flock' : 'New batch'}
        </Text>

        {type === 'dairy' && (
          <>
            <Field label="Name" required>
              <TextInput style={styles.input} placeholder="e.g. Nan" value={animalName} onChangeText={setAnimalName} autoCapitalize="words" />
            </Field>
            <Field label="Species">
              <Segmented
                options={DAIRY_SPECIES.map(s => s.label)}
                value={DAIRY_SPECIES.find(s => s.value === species)!.label}
                onChange={(label) => {
                  const next = DAIRY_SPECIES.find(s => s.label === label)!.value;
                  setSpecies(next);
                  // Reset breed when species changes so we don't carry "Jersey"
                  // over to a goat. Default to the first preset for the species.
                  setBreed(BREED_OPTIONS[next][0]);
                }}
              />
            </Field>
            <Field label="Breed">
              <Segmented options={BREED_OPTIONS[species]} value={breed} onChange={setBreed} />
            </Field>
            <Field label="Freshening date" required hint={species === 'cow' ? 'The date she last calved' : species === 'goat' ? 'The date she last kidded' : 'The date she last lambed'}>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={fresheningDate} onChangeText={setFresheningDate} keyboardType="numbers-and-punctuation" />
            </Field>
          </>
        )}

        {type === 'layers' && (
          <>
            <Field label="Flock name" required>
              <TextInput style={styles.input} placeholder="e.g. Barn Layers" value={flockName} onChangeText={setFlockName} autoCapitalize="words" />
            </Field>
            <Field label="Number of hens" required>
              <TextInput style={styles.input} placeholder="e.g. 12" value={henCount} onChangeText={setHenCount} keyboardType="number-pad" />
            </Field>
            <Field label="Start date" required hint="When they started laying">
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={intakeDate} onChangeText={setIntakeDate} keyboardType="numbers-and-punctuation" />
            </Field>
          </>
        )}

        {type === 'meat_birds' && (
          <>
            <Field label="Breed">
              <Segmented options={['Cornish Cross', 'Other']} value={meatBreed} onChange={setMeatBreed} />
            </Field>
            <Field label="Number of chicks" required>
              <TextInput style={styles.input} placeholder="e.g. 25" value={chickCount} onChangeText={setChickCount} keyboardType="number-pad" />
            </Field>
            <Field label="Arrival date" required>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={chickIntakeDate} onChangeText={setChickIntakeDate} keyboardType="numbers-and-punctuation" />
            </Field>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.8 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveButtonText}>Save</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {children}
    </View>
  );
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map(o => (
        <Pressable key={o} style={[styles.segment, value === o && styles.segmentActive]} onPress={() => onChange(o)}>
          <Text style={[styles.segmentText, value === o && styles.segmentTextActive]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.linen },
  content: { padding: 24, gap: 24, paddingBottom: 48 },
  backButton: { marginBottom: 4 },
  backText: { fontSize: 16, color: Colors.sage, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.charcoal, letterSpacing: -0.5 },
  cards: { gap: 10 },
  card: {
    backgroundColor: Colors.cream,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardPressed: { borderColor: Colors.sage },
  cardEmoji: { fontSize: 28 },
  cardLabel: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.charcoal },
  chevron: { fontSize: 22, color: Colors.charcoal, opacity: 0.3 },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: '600', color: Colors.charcoal },
  required: { color: Colors.rust },
  hint: { fontSize: 13, color: Colors.charcoal, opacity: 0.5 },
  input: {
    backgroundColor: Colors.cream,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.charcoal,
    minHeight: 52,
  },
  segmented: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    backgroundColor: Colors.cream,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: Colors.sage, borderColor: Colors.sage },
  segmentText: { fontSize: 14, fontWeight: '600', color: Colors.charcoal },
  segmentTextActive: { color: Colors.white },
  error: { color: Colors.rust, fontSize: 14 },
  saveButton: {
    backgroundColor: Colors.sage,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
