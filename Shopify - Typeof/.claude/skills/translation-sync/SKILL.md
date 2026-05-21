---
name: translation-sync
description: Checks that all translation keys exist across locale files, finds missing or unused keys, and ensures consistency between default and secondary locales
triggers:
  - translation sync
  - sync translations
  - missing translation
  - locale check
  - check locales
  - translation missing
  - t key not found
---

# Translation Sync Skill

## Steps

1. **Identify locale files**
   - List all files in `locales/` folder
   - Identify the default locale (usually `en.default.json`)
   - List all secondary locales (e.g., `fr.json`, `es.json`, `de.json`)

2. **Parse the default locale**
   - Read `en.default.json` as the source of truth
   - Extract all translation keys (including nested keys using dot notation)
   - Count total number of keys

3. **Compare each secondary locale**
   - For each secondary locale file:
     - Find keys present in default but missing in the locale → **Missing keys**
     - Find keys present in locale but not in default → **Orphaned keys**
     - Find keys present in both but with identical values → **Untranslated keys**

4. **Check schema locale files**
   - Scan `locales/*.default.schema.json` for schema-specific translations
   - Verify section setting labels and option names have translations
   - Cross-reference with section schemas in `sections/` folder

5. **Check Liquid usage**
   - Search all Liquid files for `{{ 't' | t }}` and `{{ 'key' | t }}` patterns
   - Verify every `| t` key exists in `en.default.json`
   - Flag any `| t` keys that have no matching entry in locale files

6. **Generate sync report**
   - List missing keys per locale with the expected value from default
   - List orphaned keys that can be safely removed
   - List untranslated keys (same value as English)
   - Provide a summary count per locale

7. **Fix options**
   - Option A: Add missing keys with placeholder values (`"TODO: translate"`)
   - Option B: Copy English value as fallback for missing keys
   - Option C: Remove orphaned keys from all locale files
   - Ask user which option to apply before making changes

## Report Format
```
Locale: fr.json
  Missing keys (12):
    - general.cart.title
    - products.facets.clear_all
    ...
  Orphaned keys (2):
    - old.removed.key
    ...
  Untranslated keys (5):
    - sections.header.logo_alt
    ...

Locale: es.json
  Missing keys (3):
  ...
```

## Common Issues
| Issue | Cause | Fix |
|-------|-------|-----|
| `translation missing: en.key` | Key used in Liquid but not in locale | Add key to `en.default.json` |
| Key exists but not translating | Wrong dot notation path | Verify nesting matches JSON structure |
| Schema labels not translating | Missing schema locale file | Add `locales/en.default.schema.json` entry |
| New locale shows English | Keys not added to new locale file | Run translation sync and add missing keys |

## Notes
- Always use `en.default.json` as the source of truth — never the other way around
- Never delete keys from `en.default.json` without searching Liquid files first
- Shopify falls back to English if a translation key is missing — this is silent, not an error
- Keep key names descriptive and grouped by feature (e.g., `cart.empty.title` not `empty_cart`)
