# Habitapp — Curated Icon Set

> Source: Lucide Icons (`lucide-react-native` v1.14.0+)
> Package: `npm install lucide-react-native` (requires `react-native-svg` v12–15)
> License: ISC (open source, free forever)
> Last updated: May 2, 2026

---

## Why Lucide

- 1,700+ icons, consistent 24px grid, 2px stroke, round caps/joins
- Tree-shakable — only the icons we import are bundled
- React Native package with named component imports
- Matches our design language: thin-stroke, minimalist, no-fill line icons in sage (#446655)

## Usage

```tsx
import { BookOpen } from 'lucide-react-native';

<BookOpen color="#446655" strokeWidth={1.8} size={20} />
```

## Rendering rules

- Stroke color: `colors.primary` (#446655) for active icons, `colors.textMuted` (#6b6e67) for inactive
- Stroke width: 1.8 (slightly thinner than Lucide default of 2, matches our editorial aesthetic)
- Size: 20px in habit rows, 24px in detail views and pickers
- No fill — line icons only

---

## Curated set (60 icons, 8 categories)

### Fitness & movement (10)
PersonStanding, Dumbbell, Activity, HeartPulse, Timer, Bike, Footprints, Trophy, Running, Volleyball

### Mind & wellness (8)
Brain, Heart, Smile, Sparkles, Moon, Sun, Bed, CloudRain

### Reading & learning (7)
BookOpen, Book, BookText, GraduationCap, SquarePen, FileText, Code

### Food & drink (8)
Coffee, CupSoda, GlassWater, Salad, UtensilsCrossed, Droplet, Apple, Egg

### Creative (7)
Palette, Music, Image, Camera, PenTool, Star, Film

### Home & routine (8)
Home, Shirt, Calendar, ListChecks, Repeat, Toilet, Bath, Lamp

### Social & connection (6)
Users, MessageSquare, Phone, Mail, NotebookPen, UserPlus

### Nature & outdoors (6)
Sprout, Leaf, TreePine, Mountain, Globe, Shield

---

## Icon picker design

- Displayed during onboarding (Worst-Day screen, Phase 1) and habit creation/edit
- Grid layout: 4 columns, grouped by category with section headers
- Selected state: `primarySoft` (#e8f5ee) background circle behind icon
- Stored in `local_habits` as the Lucide component name string (e.g., "BookOpen")
- Rendered on Today screen habit rows, Habit Detail header, Library cards

## Extending the set

To add icons: pick from Lucide's full library (https://lucide.dev/icons/), add the component name to the relevant category above, and import it in the icon picker component. Keep total under ~80 to avoid picker overwhelm.

---

## Replaces

This replaces the emoji icon picker from S9b onboarding design. Emojis render inconsistently across Android/iOS; Lucide SVGs are pixel-consistent and match our line-icon design language.
