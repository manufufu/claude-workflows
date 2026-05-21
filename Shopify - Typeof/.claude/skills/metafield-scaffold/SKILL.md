---
name: metafield-scaffold
description: Scaffolds Shopify metafield definitions — gathers the resource type, namespace, key, and value type, provides the Shopify Admin setup steps or GraphQL mutation, then writes the correct Liquid output code for every value type including file references, rich text, JSON, lists, ratings, and metaobject references
triggers:
  - metafield
  - add metafield
  - create metafield
  - metafield definition
  - custom data
  - metaobject
  - product metafield
  - collection metafield
  - variant metafield
  - page metafield
  - shop metafield
---

# Metafield Scaffold Skill

## Goal
Define a new metafield on a Shopify resource, set it up in the admin, and write the correct Liquid to read and render the value — including guards against nil, correct output filters per type, and section schema wiring where needed.

---

## Steps

### 1. Gather requirements

Ask the user for:

| Question | Example answer |
|----------|---------------|
| Which resource owns the metafield? | product, variant, collection, customer, order, page, blog, article, shop |
| What is the namespace? | `custom` (Shopify default), or any lowercase hyphenated name |
| What is the key? | `care_instructions`, `hero_video`, `size_guide` |
| What type of value will it store? | See the Type Reference table below |
| Where in the theme should it render? | Section name, snippet name, or template |
| Should the value be editable from a theme section? | Yes / No |

**Namespace convention:**
- Use `custom` for most store-owned metafields (created in Shopify admin)
- Use a descriptive namespace (e.g., `seo`, `shipping`, `reviews`) only if grouping related metafields
- Never use `app--` prefix — that is reserved for app-created metafields

---

### 2. Create the metafield definition

**Option A — Shopify Admin UI (recommended for non-developers):**
1. Go to **Shopify Admin → Settings → Custom data**
2. Select the resource type (e.g., Products)
3. Click **Add definition**
4. Fill in: Name, Namespace and key (`namespace.key`), Description, Type
5. Enable **Storefront API access** if the value must be readable in the theme
6. Click **Save**
7. Optionally click **Pin to {resource}** to show the field on every resource edit page

**Option B — GraphQL Admin API mutation (for programmatic setup):**

```graphql
mutation CreateMetafieldDefinition {
  metafieldDefinitionCreate(
    definition: {
      name: "Field Label"
      namespace: "custom"
      key: "field_key"
      type: "single_line_text_field"
      ownerType: PRODUCT
      access: {
        storefront: PUBLIC_READ
      }
    }
  ) {
    createdDefinition {
      id
      name
    }
    userErrors {
      field
      message
    }
  }
}
```

Replace `ownerType` with: `PRODUCT`, `PRODUCTVARIANT`, `COLLECTION`, `CUSTOMER`, `ORDER`, `PAGE`, `BLOG`, `ARTICLE`, `SHOP`

Replace `type` with any value from the Type Reference table.

---

### 3. Write the Liquid output

Always guard metafield access before rendering — metafields return nil when not set:

```liquid
{% if resource.metafields.namespace.key != blank %}
  {%- assign mf = resource.metafields.namespace.key -%}
  {# render mf here #}
{% endif %}
```

Replace `resource` with the correct Liquid object: `product`, `variant`, `collection`, `customer`, `page`, `blog`, `article`, or `shop`.

---

#### Output patterns by type

**single_line_text_field / multi_line_text_field**
```liquid
{% if product.metafields.custom.care_instructions != blank %}
  <p class="product__care">{{ product.metafields.custom.care_instructions.value }}</p>
{% endif %}
```

**rich_text_field** — value is pre-rendered HTML; output with `| metafield_tag` or directly:
```liquid
{% if product.metafields.custom.extended_description != blank %}
  <div class="product__rich-text">
    {{ product.metafields.custom.extended_description.value }}
  </div>
{% endif %}
```

**integer / decimal**
```liquid
{{ product.metafields.custom.stock_threshold.value }}
```

**boolean**
```liquid
{% if product.metafields.custom.is_featured.value == true %}
  <span class="badge">Featured</span>
{% endif %}
```

**date / date_time**
```liquid
{{ product.metafields.custom.launch_date.value | date: "%B %d, %Y" }}
```

**color** — value is a hex string:
```liquid
<div style="background-color: {{ product.metafields.custom.swatch_color.value }}"></div>
```

**url**
```liquid
<a href="{{ product.metafields.custom.manual_pdf.value }}">Download manual</a>
```

**rating** — value object has `.rating` and `.scale_max` properties:
```liquid
{% assign rating = product.metafields.reviews.rating.value %}
<span>{{ rating.rating }} / {{ rating.scale_max }}</span>
```

**json** — value is a parsed object; access keys directly:
```liquid
{% assign specs = product.metafields.custom.tech_specs.value %}
<ul>
  {% for item in specs %}
    <li>{{ item[0] }}: {{ item[1] }}</li>
  {% endfor %}
</ul>
```
For known key structure: `{{ specs.weight }}`, `{{ specs.dimensions }}`

**file_reference (image)**
```liquid
{% assign img = product.metafields.custom.hero_image.value %}
{% if img != blank %}
  {{
    img
    | image_url: width: 1200
    | image_tag:
      alt: img.alt,
      loading: 'lazy',
      widths: '400, 800, 1200'
  }}
{% endif %}
```

**file_reference (video)**
```liquid
{% assign vid = product.metafields.custom.demo_video.value %}
{% if vid != blank %}
  {{ vid | media_tag: autoplay: false, loop: false, controls: true }}
{% endif %}
```

**file_reference (generic file — PDF, etc.)**
```liquid
{% assign file = product.metafields.custom.manual.value %}
{% if file != blank %}
  <a href="{{ file.url }}">{{ file.url | split: '/' | last }}</a>
{% endif %}
```

**product_reference / collection_reference / page_reference**
```liquid
{% assign linked_product = product.metafields.custom.related_product.value %}
{% if linked_product != blank %}
  <a href="{{ linked_product.url }}">{{ linked_product.title }}</a>
{% endif %}
```

**variant_reference**
```liquid
{% assign upsell_variant = product.metafields.custom.upsell_variant.value %}
{% if upsell_variant != blank %}
  <p>Add {{ upsell_variant.title }} for {{ upsell_variant.price | money }}</p>
{% endif %}
```

**metaobject_reference** — access fields via `.fields.key.value`:
```liquid
{% assign guide = product.metafields.custom.size_guide.value %}
{% if guide != blank %}
  <h3>{{ guide.fields.title.value }}</h3>
  <div>{{ guide.fields.content.value }}</div>
{% endif %}
```

---

#### List types (list.*)

All list types return an array — iterate with `{% for %}`:

```liquid
{% assign features = product.metafields.custom.key_features.value %}
{% if features != blank %}
  <ul>
    {% for feature in features %}
      <li>{{ feature }}</li>
    {% endfor %}
  </ul>
{% endif %}
```

For `list.file_reference` (image list):
```liquid
{% assign gallery = product.metafields.custom.gallery.value %}
{% if gallery != blank %}
  <div class="product__gallery">
    {% for img in gallery %}
      {{ img | image_url: width: 800 | image_tag: alt: img.alt, loading: 'lazy' }}
    {% endfor %}
  </div>
{% endif %}
```

For `list.metaobject_reference`:
```liquid
{% assign steps = product.metafields.custom.how_to_use.value %}
{% for step in steps %}
  <div class="step">
    <h4>{{ step.fields.title.value }}</h4>
    <p>{{ step.fields.body.value }}</p>
  </div>
{% endfor %}
```

---

### 4. Wire to a section (if needed)

If the metafield value should be accessible as a section setting (so merchants can override it from the theme editor), use a **metaobject** setting type:

```json
{
  "type": "metaobject",
  "id": "size_guide_ref",
  "label": "Size Guide",
  "metaobject_type": "size_guide"
}
```

Access it in Liquid:
```liquid
{% assign guide = section.settings.size_guide_ref %}
```

For most resource-scoped metafields (product, collection, etc.), you do **not** need a section setting — the metafield is accessed directly from the resource object on the appropriate template. Add a section setting only when the value should be independently configurable per section placement.

---

### 5. Validate the output

After writing the Liquid, confirm:
- [ ] Metafield definition exists in Shopify Admin → Settings → Custom data
- [ ] **Storefront API access** is enabled on the definition (required for Liquid access)
- [ ] Namespace and key in Liquid exactly match the definition (`namespace.key` is case-sensitive)
- [ ] Nil guard (`{% if ... != blank %}`) wraps all output
- [ ] Images use `| image_url: width:` — never raw `.src` URLs
- [ ] For list types, iteration is used — never direct string output
- [ ] No `| json` debug output left in the file

---

## Type Reference

| Type | Use for | Liquid `.value` returns |
|------|---------|------------------------|
| `single_line_text_field` | Short text, labels | String |
| `multi_line_text_field` | Long text, notes | String (with newlines) |
| `rich_text_field` | Formatted HTML content | HTML string |
| `integer` | Counts, quantities | Integer |
| `decimal` | Prices, weights (raw) | Decimal |
| `boolean` | Flags, toggles | `true` / `false` |
| `date` | Dates only | Date string — pipe through `| date` filter |
| `date_time` | Dates + times | DateTime string |
| `color` | Hex color values | Hex string e.g. `#FF5733` |
| `url` | External or internal links | String URL |
| `json` | Structured data / arrays | Parsed object or array |
| `rating` | Star ratings | Object: `.rating`, `.scale_max` |
| `money` | Currency values | Object — use `.amount` and `.currency_code` |
| `weight` | Weight with unit | Object: `.value`, `.unit` |
| `volume` | Volume with unit | Object: `.value`, `.unit` |
| `dimension` | Size with unit | Object: `.value`, `.unit` |
| `file_reference` | Images, videos, generic files | File/Image/Video object |
| `product_reference` | Link to a product | Product object |
| `variant_reference` | Link to a variant | Variant object |
| `collection_reference` | Link to a collection | Collection object |
| `page_reference` | Link to a page | Page object |
| `metaobject_reference` | Link to a metaobject entry | Metaobject object |
| `mixed_reference` | Link to any resource | Mixed object — check `.type` first |
| `list.*` | Multiple values of any type | Array — always iterate |

## `shop` metafields

The `shop` object is available globally in all templates:

```liquid
{{ shop.metafields.custom.support_phone.value }}
{{ shop.metafields.custom.banner_message.value }}
```

Use `shop` metafields for global store-wide values that don't belong to a specific resource (support info, promotional banners, brand assets).

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| `{{ product.metafields.custom.key }}` outputs object reference | Add `.value`: `{{ product.metafields.custom.key.value }}` |
| Metafield returns blank despite being set | Storefront access is disabled on the definition — enable it in Admin |
| Image metafield shows broken URL | Use `| image_url: width: X` — the `.value` is an image object, not a URL |
| List type outputs as string | Iterate with `{% for item in mf.value %}` — `.value` is an array |
| Metaobject field is blank | Use `.fields.key.value` — `.fields.key` alone returns the field object, not the value |
| Namespace mismatch | Namespace and key are case-sensitive — copy exactly from Admin → Custom data |

## Notes
- Metafield definitions must be created before Liquid can read them — querying an undefined metafield always returns nil
- `| metafield_tag` is a convenience filter that auto-renders the correct HTML element per type — useful for prototyping but gives less control than manual output
- Metafields set on variants are accessed via `product.selected_or_first_available_variant.metafields.namespace.key`
- The `shop` global object is always available in Liquid — no template context required
- Never access metafields from apps using the `app--` namespace in Liquid unless the app has unlocked storefront access
