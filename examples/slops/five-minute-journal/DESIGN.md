---
name: Five Minute Journal
description: A warm paper daybook for morning intentions and evening reflection.
colors:
  surface: "#f1eadc"
  paper: "#faf6ec"
  ink: "#2a241c"
  muted: "#726554"
  dim: "#796c5b"
  morning: "#f7ead0"
  morningDeep: "#eed7a7"
  morningInk: "#6b4a12"
  morningAccent: "#ba843b"
  evening: "#e9ebee"
  eveningDeep: "#dce1e8"
  eveningInk: "#374959"
  eveningAccent: "#475d73"
  rule: "color-mix(in srgb, var(--slop-ink) 14%, transparent)"
typography:
  display:
    fontFamily: "\"Journal Lora\", Georgia, \"Times New Roman\", serif"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "\"Journal Lora\", Georgia, \"Times New Roman\", serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "-0.035em"
  prompt:
    fontFamily: "\"Journal Lora\", Georgia, \"Times New Roman\", serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: "23px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    lineHeight: "23px"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
rounded:
  bookmark: "7px 7px 0 0"
  checkbox: "3px"
  calendar: "12px"
  day: "5px"
  circle: "50%"
spacing:
  line-gap: "12px"
  bookmark-gap: "9px"
  prompt-gap: "14px"
  page-inline: "44px 32px"
  compact-page-inline: "28px 20px"
components:
  bookmark:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.bookmark}"
    padding: "8px 12px"
  bookmark-morning:
    backgroundColor: "{colors.morningDeep}"
    textColor: "{colors.morningInk}"
  bookmark-evening:
    backgroundColor: "{colors.eveningDeep}"
    textColor: "{colors.eveningInk}"
  writing-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "11px 0 10px"
  written:
    textColor: "{colors.morningInk}"
    padding: "6px 0"
  calendar:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.calendar}"
    padding: "12px"
  calendar-day-selected:
    backgroundColor: "{colors.morningInk}"
    textColor: "{colors.paper}"
    rounded: "{rounded.day}"
    height: "44px"
  paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
---
# Design System: Five Minute Journal

## Overview

**Creative North Star: "The Personal Daybook"**

An ivory daybook with an ochre binding and two colored bookmarks. Serif prompts give the writing a quiet, personal voice; generous ruled fields leave the page open for the owner’s words.

The material belongs to Five Minute Journal. Familiar tabs, a calendar, and a manual checkbox make the object understandable without learning a metaphor.

**Key Characteristics:**

- Warm paper and an ochre binding frame the writing.
- Morning and Evening have distinct bookmarks, words, and sun or moon marks.
- Growing fields, visible focus, and restrained state transitions support unhurried use.

## Colors

The palette combines warm ivory and ochre with a quiet slate evening register. Root `theme.ts` owns the public CSS variables; the frontmatter records their current values without renaming the API.

### Primary

Ochre Binding (`morningAccent`) identifies the book edge. Morning Paper and Bookmark (`morning`, `morningDeep`) support the sun mark, selected tab, and checkbox. Morning Ink (`morningInk`) supplies the warm period heading, active calendar day, and writing focus.

### Secondary

Evening Paper and Bookmark (`evening`, `eveningDeep`) give the moon mark and selected tab their cooler tone. Evening Ink (`eveningInk`) carries the period heading; Evening Accent (`eveningAccent`) marks the tab edge and visible control focus.

### Neutral

Ivory Paper (`paper`) is the writing surface; Warm Surround (`surface`) fills the outer viewport and idle bookmarks. Dark Ink (`ink`) carries prompts and entries; Muted Umber (`muted`) carries supporting labels; Dim Umber (`dim`) carries placeholders. The translucent `rule` derives from ink and separates writing lines without boxing them.

**The Period Rule.** Pair each period’s color with its name and sun or moon mark.

## Typography

Bundled Lora is registered as Journal Lora with weights 400–700 under the SIL Open Font License in `assets/fonts/OFL.txt`. Georgia and Times New Roman are fallbacks. Native sans-serif type carries entries and controls. The retained public `mono` token is available for compatibility but is not used as a visual role in this surface.

The frontmatter records period headings, the masthead title, prompts, writing, and tab labels. At the compact container threshold, the masthead reduces to 23px. Supporting introductions use 14px with 1.5 line height; quiet closing notes use 12px. The icon title uses the same serif at 43px with 1.2 line height.

**The Writing Rule.** Set prompts in Lora and the owner’s writing in the readable sans-serif body face.

## Layout

The resizable window starts at 560 × 780. A single paper column fills the viewport height and stops growing horizontally at 760px. Shared horizontal padding leaves room for the binding; at container widths of 420px or less it switches to the compact inset, the period mark reduces from 64px to 52px, and tab spacing tightens. Content remains vertically scrollable as entries grow.

Morning and Evening show one ritual at a time; Day stacks both editable rituals. Each writing row has a 44px minimum height and permits wrapping. The optional thought follows the writing as a secondary disclosure. The calendar overlay fits within the viewport with an 8px collision margin and scrolls when height is limited.

Export reuses the same writing-page component with static text and always includes both rituals. The icon simplifies the book to a bound ivory plate with two bookmarks and completion marks.

## Elevation & Depth

The binding uses an inset ochre band and a soft crease. Selected bookmarks have inset edge accents; the checked box has a small inset shadow. The calendar has a diffuse ambient shadow, and the icon has its own soft lift. Exact recipes are in the sidecar, extracted from the authored styles.

**The Binding Rule.** Keep material depth at the book edge and temporary overlays; writing stays on one open paper surface.

## Shapes

Straight ruled lines organize the page. Bookmarks round only their upper corners; the quiet Day tab uses an underline when selected. Circular sun and moon medallions identify the ritual. The calendar has softer outer corners and small rounded day cells. The icon rounds the fore-edge more than the spine.

## Components

- **Bookmarks:** Morning and Evening are Bits UI tabs with period colors and SVG marks. The active tab adds an inset top edge; Day uses a dark bottom edge. Tab targets are at least 46px tall. Inactive hover warms the paper.
- **Writing fields:** borderless textareas sit above a fine rule, grow with content, and preserve line breaks. Focus strengthens the underline in the current period’s ink. Suggestions are placeholders; fresh saved fields are empty.
- **Written toggle:** a Bits UI checkbox combines a small outlined square with “Mark as written” or “Written.” Checking is manual, reversible, and independent of entry content; completion also appears in bookmark and icon marks.
- **Date picker:** a Bits UI calendar in a popover supports month navigation, day selection, and Today. The selected day has warm dark ink behind ivory numerals; today is underlined. Selecting a date changes this document’s date, preserving its writing.
- **Optional thought:** a quiet disclosure exposes a growing thought field and optional author. Existing thought data opens the disclosure initially. Hiding it preserves the text.
- **Recovery:** load and save errors appear in words with a “Try again” control.

Controls use a 2px slate focus outline; fields use a warm or cool underline. Bookmark transitions last 160ms and checkbox transitions 180ms, both with ease. Reduced-motion preferences remove transitions and animations.

## Do's and Don'ts

### Do:

- Do keep the warm paper, ochre binding, and two bookmark colors recognizable across editor, export, and icon.
- Do let writing wrap and grow while keeping labels and focus visible.
- Do preserve the public theme token names when refining the palette.

### Don't:

- Don’t turn written status into a score or infer it from filled fields.
- Don’t use placeholder suggestions as saved journal entries.
- Don’t copy this daybook’s palette into other slops as a collection theme.
