// =============================================================================
// Static Nemoto flap set + grid limits.
//
// This MUST stay byte-for-byte identical to the firmware's canonical table in
// nemoto-fw/main/api/api_flaps.cpp (which itself mirrors FlapGen's
// CHARACTER_MAP). Flap values 0-63 are a stable, firmware-defined ordering;
// presets store them as a row-major grid of these ids.
//
// The cloud serves this so apps can resolve flap id -> glyph/color without
// reaching the device on the LAN.
// =============================================================================

export type NemotoFlapType = 'letter' | 'digit' | 'special' | 'blank' | 'color';

export interface NemotoFlapDef {
  /** Flap id, 0-63 — the value stored in preset grids. */
  id: number;
  type: NemotoFlapType;
  /** Canonical label, e.g. "char_A", "color_red". */
  label: string;
  /** Displayed character (UTF-8), or null for color flaps. */
  glyph: string | null;
  /** "#RRGGBB" for color flaps, or null otherwise. */
  color: string | null;
}

// Grid limits — mirror Grid::MAX_WIDTH / MAX_HEIGHT and Presets::MAX_NAME_LEN.
export const NEMOTO_GRID_MAX_WIDTH = 32;
export const NEMOTO_GRID_MAX_HEIGHT = 16;
export const NEMOTO_PRESET_MAX_NAME_LEN = 31;
export const NEMOTO_FLAP_MIN = 0;
export const NEMOTO_FLAP_MAX = 63;

const letter = (id: number, ch: string): NemotoFlapDef => ({
  id,
  type: 'letter',
  label: `char_${ch}`,
  glyph: ch,
  color: null,
});

const digit = (id: number, ch: string): NemotoFlapDef => ({
  id,
  type: 'digit',
  label: `char_${ch}`,
  glyph: ch,
  color: null,
});

const special = (id: number, label: string, glyph: string): NemotoFlapDef => ({
  id,
  type: 'special',
  label,
  glyph,
  color: null,
});

const color = (id: number, label: string, hex: string): NemotoFlapDef => ({
  id,
  type: 'color',
  label,
  glyph: null,
  color: hex,
});

// Order MUST match firmware FLAPS[64], indices 0..63.
export const NEMOTO_FLAPS: readonly NemotoFlapDef[] = [
  // 0..25: letters
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((ch, i) => letter(i, ch)),
  // 26..35: digits
  ...'0123456789'.split('').map((ch, i) => digit(26 + i, ch)),
  // 36..55: specials (FlapGen CHARS_SPECIAL order)
  special(36, 'char_excl', '!'),
  special(37, 'char_at', '@'),
  special(38, 'char_hash', '#'),
  special(39, 'char_dollar', '$'),
  special(40, 'char_percent', '%'),
  special(41, 'char_ampersand', '&'),
  special(42, 'char_lparen', '('),
  special(43, 'char_rparen', ')'),
  special(44, 'char_colon', ':'),
  special(45, 'char_dquote', '"'),
  special(46, 'char_question', '?'),
  special(47, 'char_period', '.'),
  special(48, 'char_comma', ','),
  special(49, 'char_plus', '+'),
  special(50, 'char_minus', '-'),
  special(51, 'char_equals', '='),
  special(52, 'char_slash', '/'),
  special(53, 'char_squote', "'"),
  special(54, 'char_degree', '°'),
  special(55, 'char_semicolon', ';'),
  // 56: blank
  { id: 56, type: 'blank', label: 'blank', glyph: ' ', color: null },
  // 57..62: ROYGBV colors
  color(57, 'color_red', '#DA291C'),
  color(58, 'color_orange', '#FF7500'),
  color(59, 'color_yellow', '#FFB81C'),
  color(60, 'color_green', '#009A44'),
  color(61, 'color_blue', '#0084D5'),
  color(62, 'color_purple', '#702F8A'),
  // 63: white
  color(63, 'color_white', '#FFFFFF'),
];

export const NEMOTO_FLAP_COUNT = NEMOTO_FLAPS.length; // 64
