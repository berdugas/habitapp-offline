export type ThemeId = "zen" | "cafe" | "fantasy" | "play" | "energy" | "sound";

export type Colors = {
  bg: string;
  surface: string;
  surfaceCard: string;
  surfaceHigh: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryGradientEnd: string;
  primaryLight: string;
  primarySoft: string;
  primaryText: string;
  success: string;
  danger: string;
  dangerSoft: string;
  dangerSubtle: string;
  heatDone: string;
  heatSkipped: string;
  heatMissed: string;
  offDayBorder: string;
  graduatedCircle: string;
  graduatedBadge: string;
};

export type Typography = {
  displayLg: number;
  headlineLg: number;
  headlineMd: number;
  titleLg: number;
  titleMd: number;
  titleSm: number;
  bodyLg: number;
  bodyMd: number;
  labelMd: number;
  micro: number;
};

export type Spacing = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
};

export type Radius = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
};

export type Shadows = {
  card: string;
  lift: string;
  button: string;
  cardFloat: string;
  inputField: string;
};

export type FontFamilies = {
  displayBold: string;
  displaySemi: string;
  displaySemiItalic: string;
  body: string;
  bodyMedium: string;
  bodySemi: string;
  bodyBold: string;
  bodyExtraBold: string;
};

export type RemoteFontAsset = {
  uri: string;
  hash: string; // SHA256 hex digest
  bytes: number;
};

export type FontAssets =
  | { kind: "bundled"; assets: Record<string, number> }
  | { kind: "remote"; assets: Record<string, RemoteFontAsset> };

/**
 * Light vs dark base for the theme. Drives platform chrome that can't be
 * captured by the color palette alone — currently:
 *   - BlurView tint on the tab bar (`light` blur over light surfaces, `dark`
 *     blur over dark surfaces)
 *   - StatusBar icon color (dark icons on light bg, light icons on dark bg)
 * Add new consumers sparingly — most things should read `colors.*` instead.
 */
export type ThemeMode = "light" | "dark";

export type Theme = {
  id: ThemeId;
  name: string;
  mode: ThemeMode;
  colors: Colors;
  typography: Typography;
  spacing: Spacing;
  radius: Radius;
  shadows: Shadows;
  fontFamilies: FontFamilies;
  fontAssets: FontAssets;
  previewSvg: string; // SVG XML markup, rendered via react-native-svg SvgXml
};
