import React from 'react';
import { Platform, TextInput, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

// Date-only sibling of DateTimeField. Used for log screens that write to
// DATE-typed columns (egg_collections.collection_date, meat_bird_*.sample_date,
// log_date, processing_date) — those columns don't carry a time component, so
// we render a date-only picker on web and a YYYY-MM-DD text input on native.
//
// Values are strings in "YYYY-MM-DD" form in the user's local calendar. We
// deliberately don't convert through Date objects in the public API: parsing
// "2026-05-21" via `new Date()` lands at midnight UTC, which is the *previous*
// evening west of UTC and would shift the date by a day on render. Keeping
// everything as string makes the local-vs-UTC pitfall a non-issue.

export function todayLocalKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Light validity check for the native text-input fallback. Accepts only the
// canonical YYYY-MM-DD shape — anything else gets reported as an error so the
// caller can show a hint without us silently swallowing typos.
export function isValidLocalDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}

type Props = {
  value: string; // YYYY-MM-DD, local calendar
  onChange: (yyyymmdd: string) => void;
  onError?: (msg: string | null) => void;
};

export function DateField({ value, onChange, onError }: Props) {
  if (Platform.OS === 'web') {
    // <input type="date"> renders the system date picker on every modern
    // browser (including mobile Safari/Chrome). Far better UX than rolling
    // our own calendar — and it speaks YYYY-MM-DD natively.
    return React.createElement('input', {
      type: 'date',
      value,
      onChange: (e: { target: { value: string } }) => {
        const next = e.target.value;
        if (next === '' || isValidLocalDate(next)) {
          onChange(next);
          onError?.(null);
        } else {
          onError?.('Invalid date');
        }
      },
      style: webInputStyle,
    });
  }

  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={(text) => {
        if (isValidLocalDate(text)) {
          onChange(text);
          onError?.(null);
        } else {
          onError?.('Use format YYYY-MM-DD');
        }
      }}
      placeholder="YYYY-MM-DD"
      keyboardType="numbers-and-punctuation"
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
