import {
  StyleSheet, Text, View, Pressable, TextInput,
  ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Colors } from '@/constants/Colors';
import { AnimalType, DairySpecies, createDairyAnimal, createFlock, createMeatBirdBatch } from '@/lib/queries/animals';
import { createSubscription, getTotalUserCount } from '@/lib/queries/user';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/AppContext';

const FOUNDING_MEMBER_LIMIT = 500;

// Species + per-species breed presets for the dairy picker. Mirrors add-animal.tsx
// so adding a second dairy animal later looks the same as the first one. Keep these
// short — exhaustive breed lists belong behind "Other" + a freeform field.
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

const FRESHENING_HINT: Record<DairySpecies, string> = {
  cow:   'The date she last calved — this determines days in milk',
  goat:  'The date she last kidded — this determines days in milk',
  sheep: 'The date she last lambed — this determines days in milk',
};

export default function SetupAnimalScreen() {
  const { type } = useLocalSearchParams<{ type: AnimalType }>();
  const router = useRouter();
  const { refreshAppState } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dairy fields
  const [animalName, setAnimalName] = useState('');
  const [species, setSpecies] = useState<DairySpecies>('cow');
  const [breed, setBreed] = useState('Jersey');
  const [fresheningDate, setFresheningDate] = useState('');

  // Layer fields
  const [flockName, setFlockName] = useState('');
  const [henCount, setHenCount] = useState('');
  const [intakeDate, setIntakeDate] = useState('');

  // Meat bird fields
  const [meatBreed, setMeatBreed] = useState('Cornish Cross');
  const [chickCount, setChickCount] = useState('');
  const [chickIntakeDate, setChickIntakeDate] = useState('');

  const titles: Record<AnimalType, string> = {
    dairy:      'Set up your dairy animal',
    layers:     'Set up your flock',
    meat_birds: 'Set up your batch',
  };

  async function handleSave() {
    setError(null);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Founding member check
      const totalUsers = await getTotalUserCount();
      const isFoundingMember = totalUsers < FOUNDING_MEMBER_LIMIT;
      await createSubscription(user.id, isFoundingMember);

      let displayName = '';

      if (type === 'dairy') {
        if (!animalName.trim()) throw new Error('Name is required');
        if (!fresheningDate.trim()) throw new Error('Freshening date is required');
        await createDairyAnimal(user.id, { name: animalName.trim(), species, breed, fresheningDate });
        displayName = animalName.trim();

      } else if (type === 'layers') {
        if (!flockName.trim()) throw new Error('Flock name is required');
        if (!henCount.trim() || isNaN(Number(henCount))) throw new Error('Number of hens is required');
        if (!intakeDate.trim()) throw new Error('Start date is required');
        await createFlock(user.id, { name: flockName.trim(), henCount: Number(henCount), intakeDate });
        displayName = flockName.trim();

      } else if (type === 'meat_birds') {
        if (!chickCount.trim() || isNaN(Number(chickCount))) throw new Error('Number of chicks is required');
        if (!chickIntakeDate.trim()) throw new Error('Arrival date is required');
        await createMeatBirdBatch(user.id, { breed: meatBreed, chickCount: Number(chickCount), intakeDate: chickIntakeDate });
        displayName = `${meatBreed} batch`;
      }

      // Refresh app state so layout knows onboarding is done
      await refreshAppState();
      router.replace({ pathname: '/(onboarding)/ready', params: { name: displayName, type } });

    } catch (e: any) {
      console.error('Setup error:', e);
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>{titles[type]}</Text>

        {type === 'dairy' && (
          <>
            <Field label="Name" required>
              <TextInput
                style={styles.input}
                placeholder="e.g. Nan"
                value={animalName}
                onChangeText={setAnimalName}
                autoCapitalize="words"
              />
            </Field>

            <Field label="Species">
              <View style={styles.segmented}>
                {DAIRY_SPECIES.map(({ value, label }) => (
                  <Pressable
                    key={value}
                    style={[styles.segment, species === value && styles.segmentActive]}
                    onPress={() => {
                      setSpecies(value);
                      // Reset breed so a goat doesn't carry a "Jersey" label.
                      setBreed(BREED_OPTIONS[value][0]);
                    }}
                  >
                    <Text style={[styles.segmentText, species === value && styles.segmentTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>

            <Field label="Breed">
              <View style={styles.segmented}>
                {BREED_OPTIONS[species].map((b) => (
                  <Pressable
                    key={b}
                    style={[styles.segment, breed === b && styles.segmentActive]}
                    onPress={() => setBreed(b)}
                  >
                    <Text style={[styles.segmentText, breed === b && styles.segmentTextActive]}>{b}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>

            <Field label="Freshening date" required hint={FRESHENING_HINT[species]}>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={fresheningDate}
                onChangeText={setFresheningDate}
                keyboardType="numbers-and-punctuation"
              />
            </Field>
          </>
        )}

        {type === 'layers' && (
          <>
            <Field label="Flock name" required>
              <TextInput
                style={styles.input}
                placeholder="e.g. Barn Layers"
                value={flockName}
                onChangeText={setFlockName}
                autoCapitalize="words"
              />
            </Field>

            <Field label="Number of hens" required>
              <TextInput
                style={styles.input}
                placeholder="e.g. 12"
                value={henCount}
                onChangeText={setHenCount}
                keyboardType="number-pad"
              />
            </Field>

            <Field label="When did they start laying?" required hint="Approximate date is fine">
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={intakeDate}
                onChangeText={setIntakeDate}
                keyboardType="numbers-and-punctuation"
              />
            </Field>
          </>
        )}

        {type === 'meat_birds' && (
          <>
            <Field label="Breed">
              <View style={styles.segmented}>
                {['Cornish Cross', 'Other'].map((b) => (
                  <Pressable
                    key={b}
                    style={[styles.segment, meatBreed === b && styles.segmentActive]}
                    onPress={() => setMeatBreed(b)}
                  >
                    <Text style={[styles.segmentText, meatBreed === b && styles.segmentTextActive]}>{b}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>

            <Field label="Number of chicks" required>
              <TextInput
                style={styles.input}
                placeholder="e.g. 25"
                value={chickCount}
                onChangeText={setChickCount}
                keyboardType="number-pad"
              />
            </Field>

            <Field label="Chick arrival date" required>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={chickIntakeDate}
                onChangeText={setChickIntakeDate}
                keyboardType="numbers-and-punctuation"
              />
            </Field>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveButtonText}>Save and continue</Text>
          }
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, required, hint, children,
}: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.linen,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 48,
    gap: 24,
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 16,
    color: Colors.sage,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.charcoal,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.charcoal,
  },
  required: {
    color: Colors.rust,
  },
  hint: {
    fontSize: 13,
    color: Colors.charcoal,
    opacity: 0.55,
  },
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
  segmented: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    backgroundColor: Colors.cream,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.charcoal,
  },
  segmentTextActive: {
    color: Colors.white,
  },
  error: {
    color: Colors.rust,
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: Colors.sage,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
