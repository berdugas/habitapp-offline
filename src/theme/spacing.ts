export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Top padding added to `insets.top` for the screen's first scroll/content area.
// Use HERO for tab-root surfaces (Today, future landing screens) where airy
// space reinforces "you've arrived"; use the default for any nested screen
// that opens with a back button so the button stays in thumb-reach.
export const SCREEN_TOP_PADDING = spacing.lg;
export const SCREEN_TOP_PADDING_HERO = spacing.lg;
