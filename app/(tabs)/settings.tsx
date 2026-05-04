import {
  StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, Switch,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const UNIT_KEY = 'haymow_yield_unit';

async function getStoredUnit(): Promise<'gal' | 'lbs'> {
  try {
    const val = Platform.OS === 'web'
      ? localStorage.getItem(UNIT_KEY)
      : await SecureStore.getItemAsync(UNIT_KEY);
    return val === 'lbs' ? 'lbs' : 'gal';
  } catch {
    return 'gal';
  }
}

async function storeUnit(unit: 'gal' | 'lbs') {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(UNIT_KEY, unit);
    } else {
      await SecureStore.setItemAsync(UNIT_KEY, unit);
    }
  } catch {}
}

type UserInfo = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

export default function SettingsScreen() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [tier, setTier] = useState<string>('free');
  const [yieldUnit, setYieldUnit] = useState<'gal' | 'lbs'>('gal');
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        setUser({
          email: u.email ?? '',
          name: u.user_metadata?.full_name ?? u.email ?? '',
          avatarUrl: u.user_metadata?.avatar_url ?? null,
        });

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('tier, is_founding_member')
          .eq('user_id', u.id)
          .maybeSingle();

        if (sub) setTier(sub.is_founding_member ? 'homestead (founding member)' : sub.tier);
      }

      const unit = await getStoredUnit();
      setYieldUnit(unit);
    }
    load();
  }, []);

  async function handleUnitToggle(val: boolean) {
    const unit = val ? 'lbs' : 'gal';
    setYieldUnit(unit);
    await storeUnit(unit);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Settings</Text>

      {/* Account */}
      <Section title="Account">
        {user && (
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>
                {(user.name ?? user.email)[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>
        )}
      </Section>

      {/* Preferences */}
      <Section title="Preferences">
        <Row label="Show yield in lbs" hint="Default is gallons">
          <Switch
            value={yieldUnit === 'lbs'}
            onValueChange={handleUnitToggle}
            trackColor={{ false: Colors.border, true: Colors.sage }}
            thumbColor={Colors.white}
          />
        </Row>
      </Section>

      {/* Farm */}
      <Section title="Farm">
        <Row label="Feed inventory" hint="Track what you have on hand">
          <Pressable
            style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.6 }]}
            onPress={() => router.push('/feed-management')}
          >
            <Text style={styles.navRowText}>Manage →</Text>
          </Pressable>
        </Row>
      </Section>

      {/* Subscription */}
      <Section title="Subscription">
        <Row label="Plan">
          <Text style={styles.tierBadge}>{tier}</Text>
        </Row>
        <Text style={styles.tierNote}>
          Paid plans coming in a future update.
        </Text>
      </Section>

      {/* Sign out */}
      <Section title="">
        <Pressable
          style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.7 }]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut
            ? <ActivityIndicator color={Colors.rust} />
            : <Text style={styles.signOutText}>Sign out</Text>
          }
        </Pressable>
      </Section>

      <Text style={styles.version}>Haymow · Early access</Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Text style={styles.rowLabelText}>{label}</Text>
        {hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
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
    padding: 20,
    gap: 8,
    paddingBottom: 60,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.charcoal,
    letterSpacing: -0.5,
    marginBottom: 8,
    paddingTop: 8,
  },
  section: {
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.charcoal,
    opacity: 0.4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  sectionCard: {
    backgroundColor: Colors.cream,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  profileText: {
    gap: 2,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.charcoal,
  },
  profileEmail: {
    fontSize: 13,
    color: Colors.charcoal,
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowLabel: {
    gap: 2,
    flex: 1,
  },
  rowLabelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.charcoal,
  },
  rowHint: {
    fontSize: 12,
    color: Colors.charcoal,
    opacity: 0.45,
  },
  tierBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.sage,
    textTransform: 'capitalize',
  },
  tierNote: {
    fontSize: 12,
    color: Colors.charcoal,
    opacity: 0.45,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  signOutButton: {
    padding: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.rust,
  },
  navRow: {},
  navRowText: { fontSize: 14, fontWeight: '600', color: Colors.sage },
  version: {
    fontSize: 12,
    color: Colors.charcoal,
    opacity: 0.3,
    textAlign: 'center',
    marginTop: 16,
  },
});
