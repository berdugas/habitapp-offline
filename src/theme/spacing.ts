import { zen } from "@/theme/themes/zen";

export const spacing = zen.spacing;

// Top padding added to `insets.top` for the screen's first scroll/content area.
// Use HERO for tab-root surfaces (Today, future landing screens) where airy
// space reinforces "you've arrived"; use the default for any nested screen
// that opens with a back button so the button stays in thumb-reach.
export const SCREEN_TOP_PADDING = spacing.lg;
export const SCREEN_TOP_PADDING_HERO = spacing.lg;
