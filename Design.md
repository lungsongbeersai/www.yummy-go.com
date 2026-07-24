# Yummy-Go Quiet Service Ledger Design System

This document is the normative visual and interaction specification for Yummy-Go across web, Electron, and Capacitor surfaces. It defines the intended product language; it does not claim that every existing screen already conforms.

## 1. Product context

Yummy-Go is a Lao-first restaurant operating system spanning POS ordering, checkout, table sales, products, stock, printing, reports, permissions, public QR ordering, and multi-surface delivery.

The design is not a generic analytics skin or a recolor of the legacy POS. Its signature is a **quiet service ledger**: warm working surfaces, precise rules, aligned totals, compact operational density, progressive disclosure, and controlled green markers.

### Evidence boundary

- Repository source: the current Yummy-Go project.
- Preserved identity: `public/brand/icon.png`.
- Token implementation target: `src/app/globals.css`.
- UI primitives: `src/components/ui/` and `src/components/common/`.
- Screen compositions: `src/features/`.
- Target canvases: iPhone 15 Pro at 393 × 852 and iPad at 1024 × 1366.
- Live production values, role-specific navigation, and unverified native-platform capabilities must not be invented. Use explicitly labelled sample data when production data is unavailable.

## 2. Anthropic-inspired design contract

The system is inspired by the observable qualities of Anthropic's design approach: warm restraint, editorial hierarchy, content-first composition, quiet surfaces, precise borders, and deliberate interaction states.

It is not an Anthropic or Claude replica. Do not copy proprietary assets, layouts, components, illustrations, wording, or typography.

Anthropic's approximate terracotta reference, `#D97757`, is replaced by Yummy-Go brand green `#16A34A`. Do not use `#D97757` in the product UI. Use green with the same restraint as a controlled accent, not as a large background field.

The actual application must remain operational rather than editorial:

- Use serif typography only for page orientation, section introductions, and prominent totals.
- Use sans-serif typography for navigation, inputs, tables, dialogs, buttons, tickets, and dense POS controls.
- Do not place giant marketing-style headlines or decorative section numbering inside working screens.
- Preserve fast scanning, one-hand reach, and transaction efficiency even when that requires tighter spacing.

## 3. Principles

1. **Operational before ornamental.** Every visual mark improves scanning, selection, status, or recovery.
2. **Ledger rhythm.** Financial and order rows use aligned values and dotted dividers; totals use a stronger rule and restrained editorial emphasis.
3. **Warm intelligence.** Warm neutrals, quiet hierarchy, and restrained typography create the Anthropic-inspired posture—not decorative chrome.
4. **Lao-first clarity.** Working UI uses a legible Lao-capable sans stack. Serif is reserved for orientation and important totals.
5. **Green is a marker.** Green identifies brand, selection, primary action, and chart emphasis. It never becomes a large canvas wash.
6. **Borders before shadows.** Group with spacing and warm rules; reserve elevation for overlays and floating actions.
7. **Progressive disclosure.** Keep the current task visible and move secondary detail into sheets, panels, or expandable regions.
8. **State must survive failure.** Network and printing errors must preserve the order, cart, filters, and entered values.

## 4. Color

The following palette is normative. Implement it through semantic variables in `src/app/globals.css`; components must consume semantic tokens instead of hard-coded colors.

### Core color contract

| Role | Light | Dark | Use |
|---|---:|---:|---|
| Canvas | `oklch(96.8% 0.012 83)` / `#F7F4ED` | `oklch(17.8% 0.010 75)` / `#171613` | App background |
| Surface | `oklch(99.2% 0.009 79)` / `#FFFCF7` | `oklch(22.4% 0.012 75)` / `#201E1A` | Cards, sheets, panels |
| Ink | `oklch(24.8% 0.014 56)` / `#25211D` | `oklch(94.5% 0.013 78)` / `#F3EEE5` | Primary text |
| Muted | `oklch(52.5% 0.017 67)` / `#706A61` | `oklch(72.2% 0.017 72)` / `#B9B0A5` | Metadata and helper copy |
| Border | `oklch(87.7% 0.021 75)` / `#DED7CC` | `oklch(31.5% 0.017 72)` / `#3A352E` | Dividers and outlines |
| Brand | `oklch(63.4% 0.177 149)` / `#16A34A` | `oklch(70.5% 0.174 149)` / `#22C55E` | Identity and selection |

### Semantic color

- Primary action: `#15803D`.
- Pressed action: `#166534`.
- Selected or positive surface: `#DCFCE7` light, `#173C25` dark.
- Error: `#B42318` light, `#FFB4AB` dark.
- Warning: `#A15C07` light, `#F3BC6A` dark.
- Data series may use teal for paid, blue for secondary comparison, and plum for debt.
- Pair every chart series with line style, hatch, icon, pattern, or text; color must never be the only differentiator.
- Do not place normal-size white text on `#16A34A`. Use `#15803D` or darker for solid actions containing white labels.

## 5. Typography

| Role | Stack | Typical use |
|---|---|---|
| Lao display | `"Noto Serif Lao", "Noto Sans Lao", serif` | Page titles and prominent totals |
| Latin display | `Newsreader, "Source Serif 4", Georgia, serif` | Editorial headings and large totals |
| Application UI | `"Noto Sans Lao", "Noto Sans", system-ui, sans-serif` | Controls, tables, tickets, navigation |
| Technical | `"JetBrains Mono", ui-monospace, Consolas, monospace` | IDs, times, ranks, technical metadata |

- Use tabular numerals for every currency, quantity, count, and comparison column.
- Keep mobile display values within their column; wrap or reduce the display scale rather than forcing overflow.
- Reference sizes: 32/40 display, 23/30 page title, 16/24 section heading, 14/20 UI, 12/18 body, 11/16 metadata.
- Use editorial type sparingly. Dense interfaces must remain quiet and highly legible.
- Load approved fonts through `next/font` when implemented. Do not add unlicensed font binaries.

## 6. Spacing, radius, and elevation

- Base scale: `4, 8, 12, 16, 20, 24, 32, 40` px.
- Mobile outer margin: 16 px; common gap: 12 px; four-column rhythm.
- iPad outer margin: 24–32 px; common gap: 16 px; twelve-column rhythm.
- Minimum touch target: 44 px; use 48 px for Android-specific production variants.
- Control radius: 10–11 px.
- Product and summary panel radius: 12–14 px.
- Mobile sheets: 16 px top corners.
- Pills are reserved for compact status and filter labels.
- Use 1 px warm borders and dotted dividers for transaction detail.
- Ordinary analytics panels use borders, not elevation.
- Floating actions use a subtle, short shadow. Overlays may use a deeper, wider shadow.

## 7. Layout and composition

### Phone

- Target canvas: 393 × 852.
- Use a top bar plus a five-destination bottom navigation: Dashboard, Tables, POS, Reports, and More.
- Indicate the active destination with a thin green marker, not a filled tab block.
- Dashboard order: filter context, revenue total, operating metrics, trend, table/payment status, and top products.
- POS order: search, horizontal categories, compact product list, floating cart summary, and cart/options bottom sheets.
- Keep one-hand actions visible while secondary filters and cart detail live in sheets.

### iPad

- Target canvas: 1024 × 1366.
- Use a 210 px collapsible rail, with a 72 px collapsed state, for management and dashboard contexts.
- Keep dashboard filters persistent and expand comparison, payment, table, channel, and product data.
- POS uses a true split workspace: menu browsing at left and a persistent order ticket at right.
- Side rails use a 2 px green active marker and quiet text, not filled navigation tiles.

### Responsive behavior

- Preserve task priority rather than squeezing desktop geometry onto small screens.
- Convert tables to labelled list rows on narrow viewports.
- Convert dialogs and popovers to bottom sheets when space or reach demands it.
- Do not introduce horizontal document scrolling at common phone, tablet, or desktop widths.
- Use the same tokens and component language across breakpoints, but compose layouts independently for each device class.

## 8. Components

### Buttons and controls

- Primary buttons use action green, white text, a 44 px minimum height, and a 10–11 px radius.
- Secondary buttons use a surface fill and warm border.
- Ghost actions are reserved for low-priority utilities.
- Icon buttons use a 44 × 44 px target and stroke icons. Do not use emoji as interface icons.
- Specify default, hover, pressed, focus, selected, disabled, loading, and error states.
- Validate fields on blur and preserve entered values after request failures.

### Navigation

- Mobile bottom navigation: five destinations, top active rule, and an optional small POS attention dot.
- iPad rail: compact grouped labels, 44 px rows, thin active marker, and permission-aware visibility.
- Category navigation: mobile underline tabs and iPad compact bordered filters.

### Cards and panels

- Prefer low-chrome grouped surfaces over stacked card walls.
- Place context first, a tabular or editorial value second, and comparison metadata last.
- Operational panels may share borders to read as one instrument rather than isolated tiles.

### POS products and order tickets

- Mobile products use dense horizontal rows with 58 px media tiles and a 36 px add control inside a 44 px tappable context.
- iPad products use compact three-column cards with name, options, price, stock state, and add control.
- Unavailable products remain discoverable, explain the cause, and disable addition.
- Cart and ticket rows align item price, kitchen state, options, and quantity.
- Totals use dotted sub-rows, a strong final rule, and a prominent tabular total.

### Data and status

- Tables use quiet headers, dotted body rules, and right-aligned numeric columns.
- Status badges include a text label plus a dot, icon, outline, or pattern.
- Charts may use filled areas or bars where appropriate, but series must differ by solid, dashed, block, or hatch treatment.

### Overlays and feedback

- Bottom sheets use a solid surface, top handle, clear close action, and return focus to the trigger.
- Dialogs ask a direct question, explain the consequence, place cancel first, and place confirmation last.
- Toasts confirm successful state changes briefly; they are never the only record of an error.
- Loading uses shape-matched skeletons rather than generic spinners for whole-screen content.
- Empty states name the active context and provide a reset or next action.

## 9. Loading, error, and recovery behavior

- Show loading feedback immediately.
- Show a slow-response notice after 3–5 seconds.
- Show request errors immediately when a request fails.
- When a request remains pending, provide retry or cancel after 10–15 seconds where cancellation is safe.
- Preserve the active order, cart, filters, selections, and entered form data after failure.
- Printing feedback must distinguish preparing, connecting, sending, printed, partially printed, and failed states.
- Destructive actions require an AlertDialog-style confirmation with the affected entity named explicitly.
- Retry must repeat only the failed operation and must not duplicate a sale, payment, order, or print job.

## 10. Motion and accessibility

- Press and selection feedback: 100–150 ms.
- Sheets, menus, and dialogs: 220–300 ms with an ease-out curve.
- Rail collapse: approximately 300 ms.
- Do not animate routine data refreshes beyond a restrained skeleton or value transition.
- Honor `prefers-reduced-motion`; remove non-essential animation and show overlays without travel.
- Use visible focus rings, semantic controls, labelled regions, and at least 44 px interactive targets.
- Meet WCAG AA contrast for text and meaningful interface graphics.
- Lao text must remain legible at the selected size; supporting English may clarify but must not replace primary Lao labels.

## 11. Voice and terminology

- Voice is calm, direct, operational, and recovery-oriented.
- Lead with the task or state: “ຄົ້ນຫາ”, “ຢືນຢັນ”, “ຈ່າຍເງິນ”.
- Use the existing project terminology and localization keys; do not invent synonyms for established actions.
- Keep technical IDs and sample markers explicit: `#YG-2407`, `T02`, `Sample data`.
- Explain restrictions beside the disabled action: prerequisite, permission, or stock cause.
- Error copy states what failed, what remains safe, and the immediate recovery action.
- Keep an action name consistent through control, dialog, loading state, toast, and audit record.

## 12. Implementation contract

- Use Tailwind CSS v4 for tokens, variants, responsive behavior, and styling.
- Reuse the existing shadcn/ui-style components under `src/components/ui/` before creating new primitives.
- Use Radix UI primitives for accessible interactive behavior.
- Use `class-variance-authority` for component variants.
- Use Lucide for interface icons.
- Use Recharts for analytics and data visualization.
- Use Motion only for restrained micro-interactions that improve orientation or feedback.
- Keep route files thin; substantial screen composition belongs under `src/features/`.
- Preserve light and dark mode in every component and screen touched.
- Do not introduce MUI, Ant Design, Chakra UI, React Suite, Bootstrap, or another overlapping UI framework.
- Do not add a second state manager alongside Zustand.
- Do not hard-code design colors at call sites when an appropriate semantic token exists.

## 13. Brand assets

- Use `public/brand/icon.png` without redrawing or recoloring the mark.
- Do not copy Anthropic or Claude logos, illustrations, product screenshots, or branded content.
- Preserve clear space around the Yummy-Go mark and keep it secondary to the user's current task inside operational screens.
- New image assets must have a defined product purpose; avoid decorative food illustrations and generic AI-generated restaurant imagery.

## 14. Design acceptance checklist

A screen is ready for implementation only when all applicable checks pass:

- It does not look like the legacy POS with new colors.
- It follows the quiet service ledger principles and uses the normative tokens.
- Dashboard and POS surfaces belong to the same system without sharing identical layouts.
- Mobile and iPad compositions are independently designed for their task and available space.
- Green remains a restrained marker.
- Serif is absent from dense controls, tables, tickets, and navigation.
- Light and dark mode both preserve hierarchy and contrast.
- Keyboard focus, touch targets, reduced motion, and non-color status cues are specified.
- Loading, empty, error, retry, disabled, and permission-restricted states are defined.
- Sample values are labelled and unsupported capabilities are not invented.
- The design can be implemented with the existing stack and local components.

## 15. Anti-patterns

- Do not use `#D97757` or other terracotta accents in the product UI.
- Do not turn green into a large canvas wash or apply it to every card.
- Do not use purple gradients, decorative glass, or generic SaaS card grids.
- Do not use serif for dense Lao controls, tables, tickets, or navigation.
- Do not create card walls when shared rules and grouped surfaces communicate structure.
- Do not use shadows on ordinary analytics panels.
- Do not use color alone for status or chart meaning.
- Do not hide unavailable or restricted actions without explaining why.
- Do not fabricate production branches, revenue, permissions, channel labels, or native capabilities.
- Do not copy the legacy layout geometry or reproduce Anthropic screens one-to-one.
