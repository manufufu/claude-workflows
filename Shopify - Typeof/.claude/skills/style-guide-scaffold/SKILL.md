---
name: style-guide-scaffold
description: Creates a static HTML style guide section from a Figma design file — extracts colors, typography (h1–h6, paragraphs), and button styles, wires custom fonts, then outputs all theme files
triggers:
  - style guide
  - style-guide scaffold
  - create style guide
  - scaffold style guide
  - build style guide
---

# Style Guide Scaffold Skill

## Overview

Produces these outputs from a Figma design file and user-supplied font files:

| File | What changes |
|---|---|
| `layout/theme.liquid` | Font preload links, `@font-face` declarations, color variables, typography variables |
| `frontend/entrypoints/css/base.css` | Button color variables |
| `sections/style-guide.liquid` | New static HTML style guide section (no schema) |
| `frontend/entrypoints/css/style-guide.css` | Layout styles scoped to the style guide |
| `templates/page.style-guide.json` | Page template wiring |

---

## Standing rules

### API access
**Always use PowerShell `Invoke-RestMethod`.** WebFetch cannot send custom headers and will fail on the Figma API.
```powershell
$headers = @{ "X-Figma-Token" = $token }
$result  = Invoke-RestMethod -Uri "https://api.figma.com/v1/files/$fileKey" -Headers $headers
```
**Do not use the `/styles` endpoint as the primary source.** Many files return 0 named styles. Always scan the document structure directly.

### Rate limit rules — read carefully

The Figma API rate-limits aggressively. Violating these rules will cause persistent 429s that stall the entire run.

**One API call per tool invocation.** Never chain multiple `Invoke-RestMethod` calls inside a single PowerShell block. Each call must be its own separate tool invocation — the natural gap between tool calls is the only reliable way to let the rate limit recover.

```powershell
# WRONG — two calls in one block, will trigger 429 on the second
$pages = Invoke-RestMethod -Uri ".../nodes?ids=..." -Headers $headers
$guide = Invoke-RestMethod -Uri ".../nodes?ids=..." -Headers $headers

# CORRECT — each call is a separate tool invocation
# [tool call 1] → fetch pages
# [tool call 2] → fetch guide frame
```

**Fetch deep on first contact.** Use `depth=3` (or higher when needed) so one call returns enough data to avoid follow-up calls for the same frame.

**Batch node IDs.** When fetching multiple nodes, join up to 15 IDs in a single `?ids=` request rather than one call per node.

**If a 429 occurs:**
1. Do NOT retry automatically — consecutive tool invocations fire within seconds and will keep hitting the limit.
2. Immediately stop and tell the user exactly this:
   > "Figma rate-limited the request. Please wait **60 seconds**, then type **`retry`** so I can continue."
3. When the user types "retry" (or any response), issue the identical call as the next tool invocation — the 60-second user-imposed gap is long enough for the limit to reset.
4. If a second 429 occurs after the user waited, repeat step 2 once more with the same instruction.
5. If a third 429 occurs, stop and tell the user: *"The Figma API is still rate-limited after two waits. Please wait 2 minutes and re-run `/style-guide-scaffold`."*

**`Start-Sleep` is blocked** by the tool harness — never use it. Do not try to work around the block with shorter sleeps chained together. The user-response gap is the only reliable delay.

### CSS notation
**Never use legacy `rgba(r, g, b, a)` with literal values** — the project linter rejects it.

| Wrong | Correct |
|---|---|
| `rgba(0, 0, 0, 0.1)` | `rgb(0 0 0 / 10%)` |
| `rgba(255, 255, 255, 0.75)` | `rgb(255 255 255 / 75%)` |

`rgba(var(--color-foreground), 0.15)` is fine — the variable reference is allowed.

---

## Part 1 — Inputs

### Phase 1 — Gather inputs

Ask the user for all of the following before starting:

**From Figma:**
- Figma file URL (e.g. `https://www.figma.com/design/FILEKEY/name`)
- Figma personal access token (Figma → Settings → Security → Personal access tokens, Read scope)

**Font files (user-supplied — not extracted from Figma):**
- For each custom font family: the font-family name, file names (`.woff2`, `.woff`, `.ttf`), and weight(s)
- Confirm the files are already placed in the `assets/` folder

Extract the file key from the URL — the segment after `/design/` or `/file/`:
`https://www.figma.com/design/JPDq4GP2RIP3FM2KCozBAZ/MCL` → key is `JPDq4GP2RIP3FM2KCozBAZ`

If the URL includes `?node-id=49-2488`, note it — it points to a relevant component.

---

## Part 2 — Explore Figma

### Phase 2 — Map the file structure

**Use the URL node-id as a shortcut.** If the URL contains `?node-id=48-2060`, that ID points directly to the relevant page or frame. Convert hyphens to colons (`48-2060` → `48:2060`) and fetch it at `depth=3` in a single call — this skips broad page exploration and saves API quota.

**2a — Fetch the target node directly (preferred path):**
```powershell
# One call, depth=3 — gets the frame and its children in one shot
$r = Invoke-RestMethod -Uri "https://api.figma.com/v1/files/$fileKey/nodes?ids=48:2060&depth=3" -Headers $headers
$r.nodes."48:2060".document.children | ForEach-Object {
    Write-Host "[$($_.id)] $($_.name) — $($_.type)"
}
```

If the node-id points to the whole page, its children are the top-level frames. Look for a frame whose name contains: **Developer**, **Guide**, **Style**, **Design System**, **Tokens**, **Components**, **Colors**, **Typography** — that is the guide frame. Its children (returned at depth=3) are the color/typography/button groups.

**2b — Fallback: list pages then target the guide page (only if node-id is absent):**
```powershell
# [tool call 1] — list pages only
$file = Invoke-RestMethod -Uri "https://api.figma.com/v1/files/$fileKey`?depth=1" -Headers $headers
$file.document.children | ForEach-Object { Write-Host "[$($_.id)] $($_.name)" }
```
Then in the next separate tool invocation, fetch only the page that looks like the design system page at `depth=3`.

From the child list, identify:
- TEXT nodes named `--color-*` or containing hex values → color group
- TEXT nodes named `H1`–`H6`, `Heading`, `Body`, `Paragraph` → typography group
- Label TEXT nodes containing "mobile" or "desktop" → breakpoint dividers
- COMPONENT_SET or FRAME nodes named `Button`, `CTA` → button group

---

## Part 3 — Extract from Figma

### Phase 3 — Extract colors

**Pattern A — Paired TEXT nodes (most common):**
Scan for TEXT nodes whose `name` starts with `--color-`. The adjacent TEXT node at a close Y position contains the hex value (`#6B7A5F`). Extract both.

**Pattern B — Named shapes with SOLID fills:**
For RECTANGLE or ELLIPSE nodes in the color section:
```powershell
$c   = $node.fills[0].color
$r   = [math]::Round($c.r * 255)
$g   = [math]::Round($c.g * 255)
$b   = [math]::Round($c.b * 255)
$hex = "#{0:X2}{1:X2}{2:X2}" -f $r, $g, $b
```

**Pattern C — Figma Variables:**
If `fills[0].boundVariables.color.id` exists, fetch `/v1/files/{key}/variables/local` to resolve values.

Build a final color list merging all sources:
```
[
  { cssVar: "--color-olive",   name: "Olive",   hex: "#6B7A5F", r: 107, g: 122, b: 95  },
  { cssVar: "--color-warning", name: "Warning", hex: "#EF863A", r: 239, g: 134, b: 58  },
  ...
]
```

Include all colors Figma defines — brand, semantic, and neutrals. Do not filter any out.

**Compute perceived luminance for each color** — used in Phase 9 for swatch text contrast:
```
L = (0.299 × r) + (0.587 × g) + (0.114 × b)
```
- `L ≤ 150` → dark background → swatch text color: `#FFFFFF`
- `L > 150` → light background → swatch text color: `#1A1A1A`
- Warm near-boundary tones (orange, yellow) → default to `#1A1A1A` for safety

---

### Phase 4 — Extract typography

Fetch `absoluteBoundingBox.y` for all typography nodes plus breakpoint label nodes:

```powershell
$nodes = Invoke-RestMethod -Uri "https://api.figma.com/v1/files/$fileKey/nodes?ids=$([Uri]::EscapeDataString($allTypoIds))" -Headers $headers
foreach ($id in $allTypoIds.Split(",")) {
    $n = $nodes.nodes.$id.document
    Write-Host "[$id] y=$([math]::Round($n.absoluteBoundingBox.y)) name='$($n.name)' fs=$($n.style.fontSize) fw=$($n.style.fontWeight)"
}
```

**Assign mobile vs desktop by Y position:**
1. Find Y of the "Typography - desktop" label → `$desktopLabelY`
2. Find Y of the "typography - mobile" label → `$mobileLabelY`
3. Nodes with Y between those two values → **desktop group**
4. Nodes with Y greater than `$mobileLabelY` → **mobile group**

**From each `style` object:** `fontSize ÷ 10 = rem`, `lineHeightPx ÷ 10 = rem`, `fontWeight` as integer.

**Ambiguous nodes:** prefer the body-text specimen over the label node — compare `fontSize` values; the larger or more body-appropriate one is the specimen.

**Figma name → CSS variable mapping:**

| Figma name | CSS targets |
|---|---|
| `H1`, `Heading 1`, `Display` | `--font-size-h1` / `--line-height-h1` |
| `H2`, `Heading 2` | `--font-size-h2` / `--line-height-h2` |
| `H3`, `Heading 3` | `--font-size-h3` / `--line-height-h3` |
| `H4`, `Heading 4` | `--font-size-h4` / `--line-height-h4` |
| `H5`, `Heading 5` | `--font-size-h5` / `--line-height-h5` |
| `H6`, `Heading 6` | `--font-size-h6` / `--line-height-h6` |
| `Body Large`, `Paragraph Large` | `--font-size-paragraph-large` / `--line-height-paragraph-large` |
| `Body`, `Body Regular`, `Paragraph` | `--font-size-paragraph-regular` / `--line-height-paragraph-regular` |
| `Body Small`, `Paragraph Small` | `--font-size-paragraph-small` / `--line-height-paragraph-small` |
| `Body XS`, `Caption` | `--font-size-paragraph-extra-small` / `--line-height-paragraph-extra-small` |

If paragraph-small or paragraph-extra-small are absent, keep existing `theme.liquid` values.

Build a final typography object:
```
{
  desktop: { h1: { size: 5.4, lh: 6.65, weight: 400 }, ..., paraLarge: { size: 2.0, lh: 2.8, weight: 400 } },
  mobile:  { h1: { size: 4.0, lh: 4.94, weight: 600 }, ..., paraLarge: { size: 1.8, lh: 2.8, weight: 500 } }
}
```

---

### Phase 5 — Extract button styles

Fetch the default-state Primary, Secondary, and Tertiary button components:
```powershell
$ids   = "primary_default_id,secondary_default_id,tertiary_default_id"
$nodes = Invoke-RestMethod -Uri "https://api.figma.com/v1/files/$fileKey/nodes?ids=$([Uri]::EscapeDataString($ids))" -Headers $headers
```

For each component:
- `fills[0].color` → background → convert to hex → match to Phase 3 CSS variable
- `strokes[0].color` → outline → convert to hex, or fall back to fill color
- Child TEXT node `fills[0].color` → text color → convert to hex

Build:
```
{
  primary:   { bgVar: "--color-olive", textVar: "--color-white", outlineVar: "--color-olive"  },
  secondary: { bgVar: "--color-brown", textVar: "--color-white", outlineVar: "--color-brown"  },
  tertiary:  { bgVar: "--color-black", textVar: "--color-white", outlineVar: "--color-black"  }
}
```

---

## Part 4 — Apply to theme files

### Phase 6 — Pre-flight: read theme.liquid

Before writing any edits, read `layout/theme.liquid` and identify:
- Line range of the font preload `<link>` block (around lines 69–82)
- Line range of the `@font-face` declarations inside `{% style %}` (around lines 85–101)
- Line range of the color variable block
- Line range of the mobile `:root` heading and paragraph variables
- Line range of the desktop `@media(min-width: 750px) { :root { ... } }` block
- Whether paragraph variables exist in the desktop block (they usually don't by default)

---

### Phase 7 — Wire custom fonts into theme.liquid

**Font files are static and user-supplied.** Do not attempt to extract font information from Figma. Use exactly the file names and family names the user provided in Phase 1.

**7a — Add `<link rel="preload">` tags** immediately after the last existing preload link (around line 82):

```liquid
<link
    rel='preload'
    href='{{ 'FontName-Weight.woff2' | asset_url }}'
    as='font'
    type='font/woff2'
    crossorigin
>
```

Add one `<link>` per `.woff2` file. Only preload `.woff2` — do not preload `.woff` or `.ttf`.

**7b — Add `@font-face` declarations** immediately after the last existing `@font-face` block inside `{% style %}` (around line 101):

```liquid
@font-face {
  font-family: 'FontFamilyName';
  src: url('{{ 'FontName-Weight.ttf' | asset_url }}') format('ttf'),
       url('{{ 'FontName-Weight.woff2' | asset_url }}') format('woff2'),
       url('{{ 'FontName-Weight.woff' | asset_url }}') format('woff');
  font-weight: 400;
  font-display: swap;
}
```

Add one `@font-face` block per font weight. Match the `font-weight` value to what the user specified.

**Do not remove or alter the existing `PublicSans-Regular` and `Barlow-Bold` declarations** unless the user explicitly asks to replace them.

---

### Phase 8 — Apply color variables to theme.liquid

For every color in the Phase 3 list:
```
for each { cssVar, r, g, b } in colorList:
  if cssVar already exists in theme.liquid → UPDATE in-place with new r, g, b values
  else                                     → ADD after the last existing --color-* variable
```

**Rule: if Figma defines it, apply it.** Semantic colors (`--color-success`, `--color-error`, `--color-warning`) are intentional redefinitions — update them.

**Only skip** Shopify alias variables controlled by the admin:
`--color-foreground`, `--color-background`, `--color-body-text`, `--color-heading-text`, `--color-accent-text`, `--color-primary`, `--color-secondary`, `--color-tertiary`.

---

### Phase 9 — Apply typography variables to theme.liquid

**9a — Mobile heading variables** (default `:root` block):
```css
--font-size-h1: calc(var(--font-heading-scale) * 4rem);
--line-height-h1: calc(var(--font-heading-scale) * 4.94rem);
/* h2 → h6 same pattern */
```

**9b — Mobile paragraph variables** (default `:root` block):
```css
--font-size-paragraph-large: calc(var(--font-body-scale) * 1.8rem);
--line-height-paragraph-large: calc(var(--font-body-scale) * 2.8rem);
--font-size-paragraph-regular: calc(var(--font-body-scale) * 1.6rem);
--line-height-paragraph-regular: calc(var(--font-body-scale) * 2.4rem);
```

**9c — Desktop heading variables** (`@media(min-width: 750px)` block):
```css
--font-size-h1: calc(var(--font-heading-scale) * 5.4rem);
--line-height-h1: calc(var(--font-heading-scale) * 6.65rem);
/* h2 → h6 same pattern */
```

**9d — Desktop paragraph overrides** (add to desktop block — they don't exist by default):
```css
--font-size-paragraph-large: calc(var(--font-body-scale) * 2rem);
--line-height-paragraph-large: calc(var(--font-body-scale) * 2.8rem);
--font-size-paragraph-regular: calc(var(--font-body-scale) * 1.8rem);
--line-height-paragraph-regular: calc(var(--font-body-scale) * 2.85rem);
```

---

### Phase 10 — Update button colors in base.css

Read `.button--primary`, `.button--secondary`, `.button--tertiary` in `frontend/entrypoints/css/base.css` and update the three custom properties using CSS variable references from Phase 5:

```css
.button.button--primary {
    --button-background: var(--color-olive);
    --button-colour: var(--color-white);
    --button-outline: var(--color-olive);
}
.button.button--secondary {
    --button-background: var(--color-brown);
    --button-colour: var(--color-white);
    --button-outline: var(--color-brown);
}
.button.button--tertiary {
    --button-background: var(--color-black);
    --button-colour: var(--color-white);
    --button-outline: var(--color-black);
}
```

Never hardcode hex values in base.css.

---

## Part 5 — Create style guide files

### Phase 11 — Create sections/style-guide.liquid

Plain HTML — **no `{% schema %}` block**, no Shopify settings.

#### Color swatch cards

Each swatch is a card: color block on top, metadata panel below. Both use the hardcoded hex — this is a static developer reference.

**Accessibility rule:** set `color` in the inline style on `.style-guide__swatch-info` using the luminance computed in Phase 3:
- Dark swatch (`L ≤ 150`) → `color: #FFFFFF`
- Light swatch (`L > 150`) → `color: #1A1A1A`
- Warm near-boundary tones → default to `color: #1A1A1A`

The CSS uses `color: inherit` on child elements — the inline color cascades down automatically.

```liquid
<div class="style-guide__swatch">
  <div class="style-guide__swatch-color" style="background: #6B7A5F;"></div>
  <div class="style-guide__swatch-info" style="background-color: #6B7A5F; color: #FFFFFF;">
    <p class="style-guide__swatch-name">Olive</p>
    <p class="style-guide__swatch-var">--color-olive</p>
    <p class="style-guide__swatch-hex">#6B7A5F</p>
  </div>
</div>
```

#### Full section template

```liquid
{%- liquid
  render 'vite-tag-wrapper' with 'css/style-guide.css'
-%}

<div class="style-guide">

  <section class="style-guide__section">
    <h2 class="style-guide__section-title">Colors</h2>
    <div class="style-guide__swatches">
      <!-- one card per color from Phase 3, with luminance-based color on each info panel -->
    </div>
  </section>

  <section class="style-guide__section">
    <h2 class="style-guide__section-title">Typography — Desktop</h2>
    <div class="style-guide__type-row">
      <span class="style-guide__type-label">--font-size-h1 — 5.4rem / 6.65rem lh / 400</span>
      <h1>The quick brown fox jumps over the lazy dog</h1>
    </div>
    <!-- h2 → h6, then paragraph-large → paragraph-extra-small -->
  </section>

  <section class="style-guide__section">
    <h2 class="style-guide__section-title">Typography — Mobile</h2>
    <p class="style-guide__note">Values below 750px breakpoint.</p>
    <div class="style-guide__type-table">
      <div class="style-guide__type-table-row">
        <span class="style-guide__type-table-label">H1</span>
        <span class="style-guide__type-table-value">4.0rem / 4.94rem lh / 600</span>
      </div>
      <!-- h2 → h6, paragraph-large, paragraph-regular -->
    </div>
  </section>

  <section class="style-guide__section">
    <h2 class="style-guide__section-title">Fonts</h2>
    <p class="style-guide__note">Custom font families loaded via @font-face.</p>
    <div class="style-guide__type-table">
      <!-- one row per font family declared in Phase 7 -->
      <div class="style-guide__type-table-row">
        <span class="style-guide__type-table-label" style="font-family: 'FontFamilyName';">Font Family Name</span>
        <span class="style-guide__type-table-value">FontName-Weight.woff2 — weight 400</span>
      </div>
    </div>
  </section>

  <section class="style-guide__section">
    <h2 class="style-guide__section-title">Buttons</h2>

    <div class="style-guide__subsection-title">Default</div>
    <div class="style-guide__button-row">
      <button class="button button--primary">Primary</button>
      <button class="button button--secondary">Secondary</button>
      <button class="button button--tertiary">Tertiary</button>
    </div>

    <div class="style-guide__subsection-title">Disabled</div>
    <div class="style-guide__button-row">
      <button class="button button--primary" disabled>Primary</button>
      <button class="button button--secondary" disabled>Secondary</button>
      <button class="button button--tertiary" disabled>Tertiary</button>
    </div>

    <div class="style-guide__subsection-title">Sizes</div>
    <div class="style-guide__button-row">
      <button class="button button--primary button--small">Small</button>
      <button class="button button--primary button--medium">Medium</button>
      <button class="button button--primary">Default</button>
    </div>
  </section>

</div>
```

Every value must be real — no `{placeholder}` text in the final output.

---

### Phase 12 — Create frontend/entrypoints/css/style-guide.css

```css
.style-guide {
    max-width: 120rem;
    margin: 0 auto;
    padding: 4rem 2rem;
}

.style-guide__section {
    margin-bottom: 6.4rem;
}

.style-guide__section-title {
    font-size: var(--font-size-h2);
    line-height: var(--line-height-h2);
    margin-bottom: 2.4rem;
    padding-bottom: 1.2rem;
    border-bottom: 0.1rem solid rgba(var(--color-foreground), 0.15);
}

.style-guide__note {
    font-size: var(--font-size-paragraph-small);
    line-height: var(--line-height-paragraph-small);
    color: rgba(var(--color-foreground), 0.5);
    margin-bottom: 2.4rem;
}

.style-guide__swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 1.6rem;
}

.style-guide__swatch {
    flex: 1 1 14rem;
    max-width: 20rem;
    border-radius: 0.8rem;
    border: 0.1rem solid rgba(var(--color-foreground), 0.12);
    overflow: hidden;
}

.style-guide__swatch-color {
    width: 100%;
    height: 10rem;
}

/* background-color and color are set via inline style on each element.
   color: inherit lets the inline color cascade to all child text elements. */
.style-guide__swatch-info {
    padding: 1.2rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    border-top: 0.1rem solid rgb(0 0 0 / 10%);
}

.style-guide__swatch-name {
    font-size: var(--font-size-paragraph-small);
    line-height: var(--line-height-paragraph-small);
    font-weight: 600;
    color: inherit;
    margin: 0;
}

.style-guide__swatch-var {
    font-size: var(--font-size-paragraph-extra-small);
    line-height: var(--line-height-paragraph-extra-small);
    color: inherit;
    opacity: 0.75;
    font-family: monospace;
    margin: 0;
}

.style-guide__swatch-hex {
    font-size: var(--font-size-paragraph-extra-small);
    line-height: var(--line-height-paragraph-extra-small);
    color: inherit;
    opacity: 0.6;
    font-family: monospace;
    margin: 0;
}

.style-guide__type-row {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    margin-bottom: 3.2rem;
    padding-bottom: 3.2rem;
    border-bottom: 0.1rem solid rgba(var(--color-foreground), 0.08);
}

.style-guide__type-label {
    font-size: var(--font-size-paragraph-extra-small);
    line-height: var(--line-height-paragraph-extra-small);
    color: rgba(var(--color-foreground), 0.5);
    font-family: monospace;
}

.style-guide__type-row h1,
.style-guide__type-row h2,
.style-guide__type-row h3,
.style-guide__type-row h4,
.style-guide__type-row h5,
.style-guide__type-row h6,
.style-guide__type-row p {
    margin: 0;
}

.style-guide__type-table {
    display: flex;
    flex-direction: column;
    border: 0.1rem solid rgba(var(--color-foreground), 0.15);
    border-radius: 0.8rem;
    overflow: hidden;
}

.style-guide__type-table-row {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 1.2rem 1.6rem;
    border-bottom: 0.1rem solid rgba(var(--color-foreground), 0.08);
}

.style-guide__type-table-row:last-child {
    border-bottom: none;
}

.style-guide__type-table-label {
    font-size: var(--font-size-paragraph-small);
    line-height: var(--line-height-paragraph-small);
    font-weight: 600;
    min-width: 16rem;
}

.style-guide__type-table-value {
    font-size: var(--font-size-paragraph-extra-small);
    line-height: var(--line-height-paragraph-extra-small);
    color: rgba(var(--color-foreground), 0.6);
    font-family: monospace;
}

.style-guide__subsection-title {
    font-size: var(--font-size-paragraph-small);
    line-height: var(--line-height-paragraph-small);
    font-weight: 600;
    color: rgba(var(--color-foreground), 0.5);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 1.2rem;
    margin-top: 2.4rem;
}

.style-guide__subsection-title:first-of-type {
    margin-top: 0;
}

.style-guide__button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.2rem;
    margin-bottom: 0.8rem;
}

@media (min-width: 750px) {
    .style-guide {
        padding: 6.4rem 4rem;
    }

    .style-guide__swatches {
        gap: 2.4rem;
    }
}
```

---

### Phase 13 — Create templates/page.style-guide.json

```json
{
  "sections": {
    "style-guide": {
      "type": "style-guide"
    }
  },
  "order": ["style-guide"]
}
```

---

## Part 6 — Validate

### Phase 14 — Checklist

**layout/theme.liquid:**
- [ ] New `<link rel="preload">` tags added for each user-supplied `.woff2` file
- [ ] New `@font-face` declarations added for each user-supplied font family and weight
- [ ] Existing font declarations left untouched unless user asked to replace them
- [ ] Mobile `:root` heading font-sizes and line-heights updated (h1–h6)
- [ ] Mobile `:root` paragraph font-sizes and line-heights updated (large, regular at minimum)
- [ ] Desktop `@media` heading values updated (h1–h6)
- [ ] Desktop `@media` paragraph overrides added
- [ ] Every Figma color applied: existing variables updated in-place, new ones appended
- [ ] Shopify alias variables untouched (`--color-foreground`, `--color-background`, etc.)

**frontend/entrypoints/css/base.css:**
- [ ] Button variants use `var(--color-*)` — no hardcoded hex

**sections/style-guide.liquid:**
- [ ] No `{% schema %}` block
- [ ] Uses `render 'vite-tag-wrapper'` — no `asset_url` filter
- [ ] Every color swatch has a real hex value — no placeholder text
- [ ] Every `.style-guide__swatch-info` has both `background-color` and `color` in its inline style
- [ ] Dark swatches (`L ≤ 150`) → `color: #FFFFFF`; light swatches → `color: #1A1A1A`
- [ ] Fonts section lists each user-supplied font family with its file name and weight
- [ ] Every typography label has real rem and weight values
- [ ] Mobile table covers all heading levels and at least paragraph-large and paragraph-regular

**frontend/entrypoints/css/style-guide.css:**
- [ ] No `rgba(r, g, b, a)` with literal numeric values
- [ ] `.style-guide__swatch-name/var/hex` use `color: inherit`
- [ ] `.style-guide__swatch-var` and `.style-guide__swatch-hex` use `opacity` for hierarchy
