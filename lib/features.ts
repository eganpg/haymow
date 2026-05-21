// MVP feature flags. Read once at module load — the env vars are baked into
// the bundle at build time (Expo's EXPO_PUBLIC_* convention), so there's no
// dynamic reload story here. Flip a flag → restart the dev server → rebuild.
//
// Why flags instead of ripping code out: the dairy-first launch (locked
// 2026-05-05, see CLAUDE.md) parks meat birds rather than killing them. Keeping
// the code behind a flag means flipping it back on is a one-line change when
// batch tracking is ready, instead of a revert/rebuild of multiple screens.
//
// Defaults are intentionally conservative: anything not explicitly enabled is
// off, so a forgotten env var in a prod build hides the feature rather than
// leaking unfinished work to users.

function readBoolFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === '') return false;
  return fallback;
}

// Meat birds (Cornish Cross batch tracking) — off for the MVP launch. The
// onboarding pick-type card, the Add-Animal flow, the Animals-tab section,
// and the /batch-profile route all check this. Default OFF.
export const MEAT_BIRDS_ENABLED = readBoolFlag(
  process.env.EXPO_PUBLIC_ENABLE_MEAT_BIRDS,
  false,
);
