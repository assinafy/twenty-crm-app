---
name: Assinafy for Twenty — v2
description: Assinafy v2 identity adapted to signature and contract tasks inside Twenty.
colors:
  page: "#F5F7FB"
  surface: "#FFFFFF"
  text: "#001122"
  muted: "#384756"
  primary: "#1452FF"
  primary-hover: "#143CB9"
  primary-active: "#0F2F94"
  primary-muted: "#EBF1FF"
  navy: "#0A1A4A"
  sky: "#D8E5FF"
  mint: "#CFF4E3"
  neutral: "#EEF2F8"
  border: "#DFE6EE"
  input-border: "#768595"
  danger: "#DC2626"
  danger-text: "#991B1B"
  danger-surface: "#FFF1F2"
  warning-text: "#8A4B00"
  warning-surface: "#FFF4E5"
  success-text: "#076341"
typography:
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  section:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  button:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  control: "8px"
  card: "12px"
  panel-compact: "16px"
  panel-wide: "20px"
  panel: "clamp(16px, 4%, 20px)"
  button: "999px"
spacing:
  field: "8px"
  row: "12px"
  card: "16px"
  stack: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "10px 22px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "clamp(16px, 4%, 24px)"
  panel:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "clamp(16px, 4%, 24px)"
---

# Design system: Assinafy for Twenty (v2)

## Overview

Assinafy v2 uses Inter, a cool gray canvas, white task cards, blue and navy emphasis,
soft sky and mint surfaces, and pill buttons. In Twenty, this identity supports
sending documents, understanding signature status and managing contract terms.
The current record, confirmed state and next available action must remain clear.

This is an embedded application. Twenty owns navigation, dialogs, connection
settings and its record interface. The app owns its front-component content;
it does not add a marketing header, hero, footer or account-registration CTA.
The v2 website's Anton display scale is a reference for promotional surfaces,
not the typography of these working panels.

### Implementation map

| File or surface | Responsibility |
| --- | --- |
| `src/constants/brand.ts` | Shared palette, Inter stack and card shadow |
| `src/front-components/components/field-styles.ts` | Inline layout, type, form and surface styles; scoped Twenty theme variables |
| `src/front-components/components/app-button.tsx` | Native Twenty button with v2 dimensions and wrapping labels |
| `src/front-components/components/send-flow.tsx` | Shared sending flow, record header and step indicator |
| `src/front-components/components/document-step.tsx`, `signers-step.tsx`, `signer-card.tsx`, `review-step.tsx` | Document selection, signer information, cost review and confirmation |
| `src/front-components/send-for-signature.front-component.tsx` | Sending from a record command |
| `src/front-components/record-signatures.front-component.tsx` | Record's Assinaturas tab, document cards, empty state and sending |
| `src/front-components/assinafy-document-panel.front-component.tsx` | Document summary, signer progress, downloads and available actions |
| `src/front-components/signature-request-tool-call.front-component.tsx` | Assistant proposal and member-confirmed sending |
| `src/front-components/components/contract-panel.tsx` | Contract terms, lifecycle actions and conflict recovery |
| `src/front-components/components/text-input.tsx`, `select-input.tsx`, `checkbox-input.tsx` | Labeled native form controls |
| `src/front-components/components/error-callout.tsx`, `loading-status.tsx`, `status-tag.tsx`, `signed-downloads.tsx` | Shared feedback, status and downloads |
| `public/logo.svg`, `src/application-config.ts` | Official symbol and application identity |
| `src/front-components/__tests__/`, `src/front-components/utils/__tests__/` | Rendering, worker compatibility and flow regression tests |

The front components run through Twenty's worker renderer. Reuse inline styles
and scoped CSS custom properties; injected stylesheets, `<style>`, external font
links and portal-based custom selects are not the implementation path. Native
selects keep the host's keyboard and popup behavior. There is no Next.js layout,
`public/brand/` stylesheet, Tailwind configuration or separate design framework.

## Colors

The app surface is explicitly light (`color-scheme: light`), including when
Twenty itself uses a dark theme. Apply `FIELD_STYLES.container` at the front
component boundary so native buttons, callouts and tags receive matching text,
background, border and state colors. Do not change the theme outside that boundary.

| Role | Value | Application |
| --- | --- | --- |
| Page | `#F5F7FB` | App canvas |
| Surface | `#FFFFFF` | Task cards and inputs |
| Text | `#001122` | Primary content |
| Muted text | `#384756` | Labels, instructions and metadata |
| Primary / focus | `#1452FF` | Main actions, links, progress and focus |
| Primary hover / active | `#143CB9` / `#0F2F94` | Main action interaction |
| Primary muted | `#EBF1FF` | Information feedback |
| Navy | `#0A1A4A` | Headings and current step |
| Sky | `#D8E5FF` | Summary, cost and empty-state panels |
| Mint | `#CFF4E3` | Confirmed-success surfaces |
| Neutral | `#EEF2F8` | Inactive steps and neutral status |
| Border | `#DFE6EE` | Decorative separators |
| Input boundary | `#768595` | Identifiable control edges on white |
| Danger | `#DC2626` | Errors and destructive action |
| Danger surface / text | `#FFF1F2` / `#991B1B` | Error status and feedback |
| Warning surface / text | `#FFF4E5` / `#8A4B00` | Cautions and uncertain status |
| Success icon/text accent | `#076341` | Legible success feedback on mint |

The website's input token `#D5DFE8` is retained in the complete reference below.
Working form controls use the darker `#768595` boundary to meet the 3:1 contrast
requirement. Soft decorative borders are not adequate as the only control edge.

Every status has text. Green means confirmed success; preparation, authorization,
loading and an unknown result must not appear as a completed signature. Use the
status mappings in `DOCUMENT_STATUS_OPTIONS`, `getStatusDisplay` and
`getSignerStatus`, rather than selecting a color in each screen.

Dark navy and primary-blue surfaces require white primary text. If expanded
beyond the current step indicator, use these v2 pairs rather than inheriting
dark text from the light container:

| Role | Navy surface | Primary-blue surface |
| --- | --- | --- |
| Supporting text | `#C3CEE9` | `rgba(255,255,255,.9)` |
| Inner card | `#14286A`, white text | White, `#001122` text |
| Border | `rgba(255,255,255,.14)` | `rgba(255,255,255,.3)` |
| Label | `#9DB8FF` | White |
| Success accent | `#1BD185` | `#1BD185` |

Sky and mint panels may use `rgba(10,26,74,.12)` for decorative borders.
Callout and tag colors must be scoped as complete pairs, including warning,
error, information, success and neutral states; inheriting one half from a dark
host theme makes the other half unreadable.

### Complete v2 reference

This is the shared brand reference. Only tokens used by this app belong in
`BRAND` and the scoped style object. Sidebar, chart, display and mono tokens
remain reference-only; they do not justify adding components or fonts.
The values are complete CSS colors, not arguments to `hsl()` or `oklch()`.

```css
:root {
  color-scheme: light;
  --page: #F5F7FB;
  --background: #FFFFFF;
  --foreground: #001122;
  --card: #FFFFFF;
  --card-foreground: #001122;
  --popover: #FFFFFF;
  --popover-foreground: #001122;
  --primary: #1452FF;
  --primary-foreground: #FFFFFF;
  --secondary: #EEF2F8;
  --secondary-foreground: #001122;
  --muted: #EEF2F8;
  --muted-foreground: #384756;
  --accent: #EEF2F8;
  --accent-foreground: #001122;
  --destructive: #DC2626;
  --destructive-foreground: #FFFFFF;
  --border: #DFE6EE;
  --input: #D5DFE8;
  --ring: #1452FF;
  --sidebar: #F5F7FB;
  --sidebar-foreground: #001122;
  --sidebar-primary: #1452FF;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #EBF1FF;
  --sidebar-accent-foreground: #001122;
  --sidebar-border: #D5DFE8;
  --sidebar-ring: #1452FF;
  --chart-1: #1452FF;
  --chart-2: #1BD185;
  --chart-3: #069E95;
  --chart-4: #152E4C;
  --chart-5: #3A5F82;
  --primary-hover: #143CB9;
  --primary-active: #0F2F94;
  --primary-muted: #EBF1FF;
  --navy: #0A1A4A;
  --sky: #D8E5FF;
  --mint: #CFF4E3;
  --brand-green: #0FA968;
  --brand-green-muted: #E9F8F1;
  --success: #1BD185;
  --success-foreground: #001122;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Anton", "Arial Narrow", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --radius-card: 12px;
  --radius-panel: 20px;
  --shadow-card: 0 2px 8px 0 rgb(12 24 52 / .06);
  --radius: .75rem;
  --radius-sm: calc(var(--radius) - .25rem);
  --radius-md: calc(var(--radius) - .125rem);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + .25rem);
  --radius-2xl: calc(var(--radius) + .75rem);
}
```

## Typography

Inter is the working UI family. The shared v2 family supports weights 400, 500,
600 and 700; the app's own styles primarily use 400 and 600. Twenty supplies the
font; the app requests `Inter, ui-sans-serif, system-ui, sans-serif` with
`font-synthesis: none`. If Inter is unavailable in a host installation, the
system fallback must remain usable. The app does not bundle or fetch fonts.

| App role | Weight | Size / line height | Usage |
| --- | --- | --- | --- |
| Panel title | 600 | 22px / 1.25, tracking `-0.03em` | Current document, sending and contract headings |
| Section title / emphasis | 600 | 16px / 1.5 | Signer headings, cost and empty-state title |
| Body / supporting content | 400 | 14px / 1.6 | Forms, summaries, descriptions and dates |
| Label / step | 600 | 13px / 1.5 | Persistent labels and step indicator |
| Hint | 400 | 13px / 1.5 | Help associated with a field |
| Button | 600 | 14px / 1.5 | Actions, including wrapped labels |

The full site scale remains Anton 400 for promotional H1/H2: H1
`clamp(46px, 7vw, 104px)` and H2 `clamp(36px, 5vw, 60px)`, both with 1.18 line
height. Up to 420px, its H1 scale is `clamp(40px, 11vw, 52px)`. Site H3 is
Inter 600, 22px/1.2 with `-0.03em` tracking, body is Inter 400, 16px/1.6, and
featured supporting text is 17px/1.6. JetBrains Mono 400/500 is reserved for code.
These display and code roles are not loaded or used in the embedded app.

Product text is Brazilian Portuguese, written directly in source through the
existing translation helpers. Use sentence case, preserve accents and full names,
and let headings wrap naturally. Do not add forced line breaks or uppercase
source text to imitate the website. Keep semantic heading levels independent
of visual size. Any future standalone font assets must retain their licenses,
serve from the same origin, use `font-display: swap`, and avoid synthetic Anton
weights; that is not a reason to bypass Twenty's renderer today.

## Layout

Use the available widget width rather than a website's 1200px wrapper. Each front
component has a 100%-width, border-box container with `min-width: 0`; rows wrap,
fields fill the available width, and long content can break without widening the
panel. Preserve readable document names, costs and action labels at 320px and
375px, at desktop widget widths, and with browser zoom.

The shared spacing rhythm is 8px within a field, 12px between row items and list
entries, 16px within cards, 20px between related form groups, and 24px between
major sections. Container, card and panel padding use `clamp(16px, 4%, 24px)`.
This adapts to the containing widget instead of the browser viewport; no
viewport media queries or independent navigation shell are required.

The sending screen starts with the task and current record, then the three-step
indicator, the current task fields, and its actions. Step items use
`flex: 1 1 100px`, 12px × 16px padding, and may wrap. They are progress indicators,
not clickable navigation. The current step also exposes `aria-current="step"`.

Keep related controls in task groups. The cost block is a sky panel with the total,
plan-document usage, available balance and any blocking reason before confirmation.
The document summary groups its name, status, progress and dates; signer details
and contract management follow. The empty document list explains how to start
using the existing send action.

The shared website uses 24px gutters (20px up to 640px), 20px panels (16px up to
640px), and smaller 12px gaps in compact layouts. The app implements that direction
through flexible widget sizing and 16–24px padding; do not transplant website
breakpoints or reduce space around touch targets merely to reproduce a hero.

## Elevation & Depth

Tonal surfaces establish hierarchy: gray canvas, white task cards, sky summaries,
and navy for the current step. Cards on the canvas use one restrained shadow:
`0 2px 8px 0 rgb(12 24 52 / .06)`. Panels are flat. Avoid stacking shadows inside
nested white surfaces; a decorative `#DFE6EE` border is enough where separation
is necessary. No gradient, glass effect or decorative animation is needed for
these tasks. Elevation must not imply that an entire card is clickable when only
its named action is interactive.

## Shapes

Cards and steps use a 12px radius. Panels use `clamp(16px, 4%, 20px)`, expressing
the `panel-compact` 16px and `panel-wide` 20px v2 radius limits. Inputs use 8px corners and a visible
1px boundary. Buttons use a 999px pill radius and can grow vertically for text.
The checkbox remains a native 20px control with a padded associated label and
44px-high row. Preserve the official symbol's proportions and whitespace;
never stretch, recolor, crop or filter `public/logo.svg`.

## Components

### Buttons and links

Use `AppButton`, which retains Twenty's native focus, loading, disabled and event
behavior. Primary actions explicitly use `variant="solid"` and `color="accent"`:
blue with white text, darker blue on hover and active. Secondary actions use
outline or ghost variants with readable dark text. Destructive actions keep the
native danger variant and confirmation flow.

All app buttons have a minimum height of 44px, 10px × 22px padding, a wrapping
label and a maximum width of 100%. Avoid fixed heights that clip Portuguese
labels. Loading and unavailable states must remain distinct; do not replace
native `disabled` with opacity alone. Download links have a minimum 44px height,
blue text and an identifiable underline. Keep browser/native keyboard focus
visible, with primary blue and an offset on custom form controls.

The broader v2 inverse button uses white with navy text on a navy/blue panel,
with sky hover. Its outline alternative uses white at 10% with a white 28% border,
then 18%/50% on hover. The current app does not place action buttons on dark panels;
add complete inverse states if that changes.

### Forms

Reuse `TextInput`, `SelectInput` and `CheckboxInput`. Inputs are white, use
14px Inter, have at least 44px height, and keep visible labels. Hints connect
through `aria-describedby`; labels connect with `htmlFor` and generated IDs.
Native selects and dates preserve platform keyboard behavior. Textareas can
resize vertically. Keep `disabled`, required validation and controlled values
intact. Checkbox changes use the existing controlled-state callback because the
worker does not reliably serialize `checked` from a browser event.

### Feedback, progress and status

Use native Twenty `Callout`, `Tag`, `ProgressBar` and `Loader`, with the scoped
light-theme colors. Errors have useful pt-BR messages and a reachable recovery
action; provider messages must be sanitized before presentation. Use `role="alert"`
for errors that need immediate announcement and `role="status"` for progress.
`LoadingStatus` includes the screen-reader text “Carregando…”. The progress bar
has the accessible name “Andamento das assinaturas” and accompanying numeric text.

Confirmed signatures use mint/green. Pending states use blue/sky; uncertain or
expiring states use amber/orange; rejected and failed states use red; neutral
states use gray. Text labels always convey the same information without color.
Biometric review remains visibly pending until Assinafy confirms certification.

### Sending and contract safety

Visual changes preserve the complete flow in [README.md](README.md#fluxo-completo-do-documento)
and the rules in [SETUP.md](SETUP.md). Selecting a source, uploading a PDF,
preparing a template and authorizing a connection do not mean invitations were sent.
Show the estimate and require the member's confirmation before a billable send or
resend; keep the immediate re-estimate and changed-cost recovery intact.

Preserve signer methods and notification channels, recent-send checks, busy
controls, duplicate-send protection and reconciliation for uncertain results.
An assistant proposal still requires the same explicit review and confirmation.
Do not make an error action silently repeat a billable call.

Root contract terms are editable when allowed; amendments remain read-only.
Preserve entered values on conflicts or uncertain outcomes, explain the block,
and offer a refresh before another mutation. Contract controls must not imply
that editing terms changes the signed PDF or requests new signatures.

### Motion and accessibility

Use no custom promotional motion. Retain native loading feedback and focus
behavior; content and actions must be usable without animation. The shared v2
recommendation is a 200ms color transition, with motion disabled under
`prefers-reduced-motion: reduce`. In this app, Twenty owns component transitions
and reduced-motion styles; do not add a script or stylesheet injection to imitate
them. Verify the host behavior whenever updating `twenty-ui`.

Maintain at least 4.5:1 contrast for normal text and 3:1 for large text and meaningful
control boundaries. Verify every used background and interaction state. Preserve
logical focus order, keyboard operation, visible focus, associated labels,
accessible action names, announcements and 44px touch targets. Hide purely
decorative icons from screen readers. Do not rely only on color, hover or drag.

## Do's and Don'ts

- Do use `BRAND`, `FIELD_STYLES` and `AppButton` for shared visual changes.
- Do keep app styling within its front-component boundary and preserve Twenty's surrounding interface.
- Do write direct Brazilian Portuguese product text with the current state and next action clear.
- Do preserve authorization, estimates, confirmations, validation and recovery behavior during visual work.
- Do use synthetic `@example.invalid` identities in fixtures, previews and screenshots.
- Don't load external fonts, introduce another UI library, or inject unsupported styles into the worker renderer.
- Don't use marketing display typography, duplicate branding or decorative navigation in working panels.
- Don't announce a successful send or signature before the confirmed result.
- Don't hide long names, costs, errors or actions to make a narrow panel look tidier.
- Don't store or expose CPF/CNPJ, credentials, signing links or provider response bodies through visual changes.

### Verification

Run `yarn lint`, `yarn check:emails`, `yarn test:coverage`, `yarn typecheck` and
`yarn build`; `yarn verify` runs them in that order. Preserve coverage thresholds.
Changes to flow behavior need regression tests; style-only changes need visual
inspection, not tests that merely repeat token values.

Inspect the actual app in Twenty at 320px, 375px and desktop widget widths, with
long document names, Portuguese accents, zoom, keyboard focus, both host themes
and reduced motion. Cover source selection, signer forms, cost confirmation,
busy/disabled states, loading, empty lists, errors, uncertain sends, each status,
downloads and contract conflicts. Capture only synthetic data. Screenshots or
checks from another integration do not validate this app.

Run installed-app integration tests only on the authorized local test instance
on port 2021. Keep missing browser, Docker, test-server or sandbox access separate
from assertion failures, and never treat source inspection as an executed visual
check. GitLab CI is outside the design change scope.
