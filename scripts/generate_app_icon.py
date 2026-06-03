#!/usr/bin/env python3
"""Generate the Habitapp app-icon assets from the in-app brand mark.

The brand logo (src/components/branding/AppLogo.tsx) is a 2x2 grid:
  - top-left, bottom-left, bottom-right: rounded-square outlines
  - top-right: filled circle
drawn in the Zen theme primary colour on the warm off-white background.

This script renders that same mark to the PNGs Expo uses for the home-screen
icon (icon.png), the Android adaptive foreground (adaptive-icon.png), the
splash logo (splash-icon.png) and the web favicon (favicon.png). It is
committed so the icons can be regenerated deterministically if the brand
colours ever change.

Usage:  python3 scripts/generate_app_icon.py
Requires:  Pillow  (pip install Pillow)
"""

from pathlib import Path

from PIL import Image, ImageDraw

# Brand colours — mirror src/theme/themes/zen.ts (the default theme) and the
# splash backgroundColor in app.config.js.
MARK_COLOR = (0x44, 0x66, 0x55, 0xFF)  # #446655 — theme.colors.primary
BG_COLOR = (0xFB, 0xF9, 0xF5, 0xFF)  # #fbf9f5 — splash / app background

SS = 4  # supersampling factor for crisp anti-aliased edges
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "icons"


def draw_mark(size: int, mark_frac: float, background: tuple | None) -> Image.Image:
    """Render the 2x2 brand mark on a `size`x`size` canvas.

    `mark_frac` is the fraction of the canvas the mark's bounding box occupies
    (centred). `background` is an RGBA fill, or None for a transparent canvas
    (used for the Android adaptive foreground, whose background colour is set
    in app.config.js).
    """
    s = size * SS
    img = Image.new("RGBA", (s, s), background if background else (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    mark_box = s * mark_frac
    gap = mark_box * 0.07
    cell = (mark_box - gap) / 2
    radius = cell * 0.16
    stroke = max(SS, round(cell * 0.075))

    ox = (s - mark_box) / 2
    oy = (s - mark_box) / 2

    def cell_xy(col: int, row: int) -> tuple[float, float]:
        return ox + col * (cell + gap), oy + row * (cell + gap)

    # Top-left, bottom-left, bottom-right: rounded-square outlines.
    for col, row in ((0, 0), (0, 1), (1, 1)):
        x, y = cell_xy(col, row)
        # Inset by half the stroke so the outline stays inside the cell box.
        h = stroke / 2
        draw.rounded_rectangle(
            [x + h, y + h, x + cell - h, y + cell - h],
            radius=radius,
            outline=MARK_COLOR,
            width=stroke,
        )

    # Top-right: filled circle.
    x, y = cell_xy(1, 0)
    draw.ellipse([x, y, x + cell, y + cell], fill=MARK_COLOR)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Home-screen icon (iOS + Android legacy): full-bleed background, the OS
    # applies its own rounded-corner mask.
    draw_mark(1024, mark_frac=0.56, background=BG_COLOR).save(OUT_DIR / "icon.png")

    # Android adaptive foreground: transparent, smaller so the mark stays
    # within the adaptive safe zone (the OS may crop to a circle/squircle).
    # Background colour comes from android.adaptiveIcon.backgroundColor.
    draw_mark(1024, mark_frac=0.46, background=None).save(OUT_DIR / "adaptive-icon.png")

    # Splash logo (resizeMode: contain on the same background).
    draw_mark(1024, mark_frac=0.42, background=BG_COLOR).save(OUT_DIR / "splash-icon.png")

    # Web favicon.
    draw_mark(48, mark_frac=0.74, background=BG_COLOR).save(OUT_DIR / "favicon.png")

    print(f"Wrote icon.png, adaptive-icon.png, splash-icon.png, favicon.png to {OUT_DIR}")


if __name__ == "__main__":
    main()
