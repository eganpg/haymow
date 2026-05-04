import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Colors } from '@/constants/Colors';
import { signInWithGoogle } from '@/lib/auth';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError('Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.wordmark}>Haymow</Text>
        <Text style={styles.tagline}>Track what your farm produces.</Text>
      </View>

      <View style={styles.actions}>
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.charcoal} />
          ) : (
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.linen,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 60,
  },
  hero: {
    alignItems: 'center',
    gap: 12,
  },
  wordmark: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.charcoal,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    color: Colors.charcoal,
    opacity: 0.6,
  },
  actions: {
    gap: 12,
  },
  googleButton: {
    backgroundColor: Colors.cream,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.charcoal,
  },
  error: {
    color: Colors.rust,
    fontSize: 14,
    textAlign: 'center',
  },
});
