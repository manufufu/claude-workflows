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

### 3. Create the section file

File goes in `sections/section-name.liquid`. Use the padding pattern resolved in Step 2.

```liquid
{{ 'section-name.css' | asset_url | stylesheet_tag }}

{%- liquid
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
```

---

### 4. Create the CSS asset

- File goes in `assets/section-name.css`
- Use BEM naming: `.section-name__element--modifier`
- Apply the padding using the same CSS approach copied from `rich-text.liquid` (Step 2)
- Start mobile-first, add breakpoints with `@media (min-width: ...)`

---

### 5. Create the JS feature (if needed)

- Invoke the `js-feature` skill — it scaffolds the JS and CSS files, wires them to the section, and starts with a static interactive feature before making it dynamic
- Do not manually create `assets/section-name.js` — delegate entirely to `js-feature`

---

### 6. Register in templates (if needed)

- For JSON templates, add the section to the relevant `templates/*.json`
- Confirm `"type": "section-name"` matches the filename exactly

---

### 7. Validate the schema

- Confirm all `id` values are unique within the schema
- Ensure `type` values are valid Shopify setting types
- Check `presets` is included so section appears in theme editor
- Verify block `type` values are lowercase with no spaces
- Confirm `padding_top` and `padding_bottom` settings are present and match the pattern from `rich-text.liquid` (or the default if that file doesn't exist)

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
- Always include `{{ block.shopify_attributes }}` on block elements for theme editor support
- Always include `id="section-{{ section.id }}"` on the root element for theme editor targeting
- Always copy the padding pattern from `sections/rich-text.liquid` when it exists — this keeps spacing consistent across all sections in the theme
- For JS-driven sections, the `js-feature` skill handles file creation, wiring, and dynamic schema — do not duplicate that work here