---
name: section-scaffold
description: Creates a new Shopify theme section with proper Liquid structure, schema settings, and JavaScript/CSS boilerplate
triggers:
  - create section
  - new section
  - scaffold section
  - add section
  - build section
---

# Section Scaffold Skill

## Steps

### 1. Gather requirements

- Ask for the section name (e.g., `featured-collection`, `hero-banner`, `testimonials`)
- Ask what settings are needed (text, image, color, url, collection, product, etc.)
- Ask if the section needs blocks (repeatable sub-items like slides, cards, tabs)
- Ask if custom JS is required — if yes, use the `js-feature` skill to scaffold it

---

### 2. Resolve the padding pattern

Before writing any code, check whether `sections/rich-text.liquid` exists in the project root.

**If `sections/rich-text.liquid` exists:**
- Read the file
- Extract the exact padding pattern it uses — including:
  - The schema settings for `padding_top` and `padding_bottom` (range min/max/step/default values)
  - The Liquid variable assignments (e.g., `assign padding_top = section.settings.padding_top`)
  - How the values are applied to the root element (inline style, CSS custom properties, or class-based)
  - The corresponding CSS declarations in its stylesheet block or asset file
- Use that exact pattern (same values, same approach) in the new section for consistency

**If `sections/rich-text.liquid` does not exist:**
- Use this default padding pattern:

  Schema settings (under a `"Spacing"` header):
  ```json
  {
    "type": "header",
    "content": "Spacing"
  },
  {
    "type": "range",
    "id": "padding_top",
    "label": "Padding top",
    "min": 0,
    "max": 100,
    "step": 4,
    "unit": "px",
    "default": 36
  },
  {
    "type": "range",
    "id": "padding_bottom",
    "label": "Padding bottom",
    "min": 0,
    "max": 100,
    "step": 4,
    "unit": "px",
    "default": 36
  }
  ```

  Liquid assignments:
  ```liquid
  {%- liquid
    assign padding_top = section.settings.padding_top
    assign padding_bottom = section.settings.padding_bottom
  -%}
  ```

  Root element inline style:
  ```liquid
  style="--padding-top: {{ padding_top }}px; --padding-bottom: {{ padding_bottom }}px;"
  ```

  CSS:
  ```css
  .section-name {
    padding-top: var(--padding-top, 36px);
    padding-bottom: var(--padding-bottom, 36px);
  }
  ```

---

### 3. Resolve asset loading

This project uses Vite for asset bundling. **Never use Shopify's `asset_url` filter** to load CSS or JS in section files.

Use `vite-tag-wrapper` instead:

```liquid
{%- liquid
  render 'vite-tag-wrapper' with 'css/section-name.css'
  render 'vite-tag-wrapper' with 'js/section-name.js'
-%}
```

Omit the JS line if no JS is needed, and omit the CSS line if no CSS is needed.

Source files live in `frontend/entrypoints/` — never write directly to `assets/`:

| Asset type | Source path |
|------------|-------------|
| CSS | `frontend/entrypoints/css/section-name.css` |
| JS | `frontend/entrypoints/js/section-name.js` |

Vite compiles these to `assets/` at build time.

**Wrong:**
```liquid
{{ 'section-name.css' | asset_url | stylesheet_tag }}
<script src="{{ 'section-name.js' | asset_url }}" defer></script>
```

**Correct:**
```liquid
{%- liquid
  render 'vite-tag-wrapper' with 'css/section-name.css'
  render 'vite-tag-wrapper' with 'js/section-name.js'
-%}
```

---

### 4. Create the section file

File goes in `sections/section-name.liquid`. Apply the padding pattern from Step 2 and the asset loading from Step 3.

```liquid
{%- liquid
  render 'vite-tag-wrapper' with 'css/section-name.css'
  assign padding_top = section.settings.padding_top
  assign padding_bottom = section.settings.padding_bottom
-%}

<div
  class="section-name"
  id="section-{{ section.id }}"
  style="--padding-top: {{ padding_top }}px; --padding-bottom: {{ padding_bottom }}px;"
>
  {%- for block in section.blocks -%}
    {%- case block.type -%}
      {%- when 'block_type' -%}
        <div class="section-name__block" {{ block.shopify_attributes }}>
          {{ block.settings.text }}
        </div>
    {%- endcase -%}
  {%- endfor -%}
</div>

{% schema %}
{
  "name": "Section Name",
  "tag": "section",
  "class": "section",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Section Heading"
    },
    {
      "type": "header",
      "content": "Spacing"
    },
    {
      "type": "range",
      "id": "padding_top",
      "label": "Padding top",
      "min": 0,
      "max": 100,
      "step": 4,
      "unit": "px",
      "default": 36
    },
    {
      "type": "range",
      "id": "padding_bottom",
      "label": "Padding bottom",
      "min": 0,
      "max": 100,
      "step": 4,
      "unit": "px",
      "default": 36
    }
  ],
  "blocks": [
    {
      "type": "item",
      "name": "Item",
      "settings": [
        {
          "type": "text",
          "id": "text",
          "label": "Text"
        }
      ]
    }
  ],
  "presets": [
    {
      "name": "Section Name"
    }
  ]
}
{% endschema %}
```

---

### 5. Create the CSS source file

- File goes in `frontend/entrypoints/css/section-name.css` (not `assets/`)
- Use BEM naming: `.section-name__element--modifier`
- Apply the padding using the same CSS approach copied from `rich-text.liquid` (Step 2)
- Start mobile-first, add breakpoints with `@media (min-width: ...)`

---

### 6. Create the JS feature (if needed)

- Invoke the `js-feature` skill — it scaffolds the JS and CSS files, wires them to the section, and starts with a static interactive feature before making it dynamic
- JS source file belongs in `frontend/entrypoints/js/section-name.js` — the `js-feature` skill must place it there, not in `assets/`
- Do not manually create the JS file — delegate entirely to `js-feature`

---

### 7. Register in templates (if needed)

- For JSON templates, add the section to the relevant `templates/*.json`
- Confirm `"type": "section-name"` matches the filename exactly

---

### 8. Validate before finishing

- All `id` values in the schema are unique
- All `type` values are valid Shopify setting types
- `presets` is included so the section appears in the theme editor
- Block `type` values are lowercase with no spaces
- `padding_top` and `padding_bottom` match the pattern from `rich-text.liquid` (or the default if that file doesn't exist)
- Asset loading uses `vite-tag-wrapper` — no `asset_url` filter present
- CSS and JS source files are in `frontend/entrypoints/`, not `assets/`

---

## Valid Shopify Setting Types

| Type | Use for |
|------|---------|
| `text` | Short single-line text |
| `textarea` | Multi-line text |
| `richtext` | Formatted text with HTML |
| `image_picker` | Image selection |
| `url` | Link/URL input |
| `color` | Color picker |
| `range` | Numeric slider |
| `select` | Dropdown options |
| `checkbox` | Boolean toggle |
| `collection` | Collection picker |
| `product` | Product picker |
| `video` | Video picker |
| `font_picker` | Font selection |

---

## Notes

- Section filename must be lowercase, hyphenated, no spaces
- Never use `<script>` or `<style>` tags inside section Liquid — Vite handles asset injection via `vite-tag-wrapper`
- Never write source files directly to `assets/` — always use `frontend/entrypoints/`
- Always include `{{ block.shopify_attributes }}` on block elements for theme editor support
- Always include `id="section-{{ section.id }}"` on the root element for theme editor targeting
- Always copy the padding pattern from `sections/rich-text.liquid` when it exists — this keeps spacing consistent across all sections in the theme
- For JS-driven sections, the `js-feature` skill handles file creation, wiring, and dynamic schema — do not duplicate that work here
