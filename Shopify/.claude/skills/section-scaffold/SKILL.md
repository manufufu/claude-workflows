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

1. **Gather requirements**
   - Ask for the section name (e.g., `featured-collection`, `hero-banner`, `testimonials`)
   - Ask what settings are needed (text, image, color, url, collection, product, etc.)
   - Ask if the section needs blocks (repeatable sub-items like slides, cards, tabs)
   - Ask if custom JS or CSS is required

2. **Create the section file**
   - File goes in `sections/` folder: `sections/section-name.liquid`
   - Follow this structure:

   ```liquid
   {{ 'section-name.css' | asset_url | stylesheet_tag }}

   <div class="section-name" id="section-{{ section.id }}">
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

   {% javascript %}
   {% endjavascript %}

   {% stylesheet %}
   {% endstylesheet %}
   ```

3. **Create the CSS asset** (if needed)
   - File goes in `assets/section-name.css`
   - Use BEM naming: `.section-name__element--modifier`
   - Start mobile-first, add breakpoints with `@media (min-width: ...)`

4. **Create the JS asset** (if needed)
   - File goes in `assets/section-name.js`
   - Use `customElements.define` for Web Components pattern
   - Wrap in `if (!customElements.get('section-name'))` guard

5. **Register in templates** (if needed)
   - For JSON templates, add the section to the relevant `templates/*.json`
   - Confirm `"type": "section-name"` matches the filename exactly

6. **Validate the schema**
   - Confirm all `id` values are unique within the schema
   - Ensure `type` values are valid Shopify setting types
   - Check `presets` is included so section appears in theme editor
   - Verify block `type` values are lowercase with no spaces

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

## Notes
- Section filename must be lowercase, hyphenated, no spaces
- Never use `<script>` tags inside section Liquid — use `{% javascript %}` tag instead
- Never use `<style>` tags inside section Liquid — use `{% stylesheet %}` tag instead
- Always include `{{ block.shopify_attributes }}` on block elements for theme editor support
- Always include `id="section-{{ section.id }}"` on the root element for theme editor targeting
