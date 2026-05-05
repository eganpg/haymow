import React from 'react';
import { Platform, TextInput, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

// Convert ISO string -> "YYYY-MM-DDTHH:MM" in the user's local time
// (the format the datetime-local input expects/returns).
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD HH:MM" interpreted as local time -> ISO.
// Returns null for unparseable input.
export function localInputToISO(local: string): string | null {
  if (!local) return null;
  const normalized = local.replace(' ', 'T');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

type Props = {
  value: string; // ISO
  onChange: (iso: string) => void;
  onError?: (msg: string | null) => void;
};

export function DateTimeField({ value, onChange, onError }: Props) {
  const localValue = isoToLocalInput(value);

  if (Platform.OS === 'web') {
    // <input type="datetime-local"> renders the system date+time picker on
    // mobile browsers — far better UX than anything we'd hand-roll.
    return React.createElement('input', {
      type: 'datetime-local',
      value: localValue,
      onChange: (e: { target: { value: string } }) => {
        const iso = localInputToISO(e.target.value);
        if (iso) {
          onChange(iso);
          onError?.(null);
        } else {
          onError?.('Invalid date or time');
        }
      },
      style: webInputStyle,
    });
  }

  // Native fallback: plain text input. Accepts "YYYY-MM-DD HH:MM".
  return (
    <TextInput
      style={styles.input}
      value={localValue.replace('T', ' ')}
      onChangeText={(text) => {
        const iso = localInputToISO(text);
        if (iso) {
          onChange(iso);
          onError?.(null);
        } else {
          onError?.('Use format YYYY-MM-DD HH:MM');
        }
      }}
      placeholder="YYYY-MM-DD HH:MM"
    />
  );
}

const webInputStyle = {
  backgroundColor: Colors.cream,
  border: `1.5px solid ${Colors.border}`,
  borderRadius: 12,
  padding: '14px 16px',
  fontSize: 16,
  color: Colors.charcoal,
  minHeight: 52,
  width: '100%',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
};

const styles = StyleSheet.create({
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
});
