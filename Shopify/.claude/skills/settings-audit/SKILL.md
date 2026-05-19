---
name: settings-audit
description: Reviews settings_schema.json and section schemas for conflicts, duplicates, invalid types, and best practices
triggers:
  - settings audit
  - audit settings
  - check schema
  - schema conflict
  - settings not showing
  - theme editor issue
  - settings_schema error
---

# Settings Audit Skill

## Steps

1. **Read settings_schema.json**
   - Open `config/settings_schema.json`
   - Check overall structure is a valid JSON array of setting groups
   - Verify each group has a `name` and `settings` array

2. **Check for duplicate IDs**
   - Scan all `id` values across the entire file
   - Flag any duplicate IDs — Shopify silently ignores duplicates which causes unexpected behavior
   - Check section schemas for IDs that clash with global settings

3. **Validate setting types**
   - Confirm all `type` values are valid Shopify setting types
   - Flag deprecated or unsupported types
   - Ensure `select` and `radio` types have an `options` array with `value` and `label`

4. **Check default values**
   - Verify all settings have a `default` value where applicable
   - Flag settings with no default that are used without nil checks in Liquid
   - Confirm `color` defaults are valid hex values

5. **Review section schemas**
   - Scan all files in `sections/` for `{% schema %}` blocks
   - Check each section schema for:
     - Missing `presets` (section won't appear in theme editor)
     - Blocks missing `type` or `name`
     - Settings missing `id` or `label`
     - Max block count not set (`"max_blocks"`)

6. **Check info and header settings**
   - Ensure `header` and `paragraph` types are used only for display (no `id` needed)
   - Flag `header`/`paragraph` types that incorrectly include an `id`

7. **Generate audit report**
   - List all issues found by file and line reference
   - Categorize as: Error / Warning / Suggestion
   - Provide corrected JSON snippets for each issue

## Common Issues
| Issue | Cause | Fix |
|-------|-------|-----|
| Setting not saving | Duplicate `id` | Rename duplicate ID |
| Section missing from editor | No `presets` in schema | Add `presets` array |
| Color picker blank | Invalid default hex | Use valid `#RRGGBB` format |
| Select shows wrong value | Missing `options` array | Add `options` with `value`/`label` |
| Block limit ignored | Missing `"max_blocks"` | Add `"max_blocks": N` to schema |

## Notes
- `settings_schema.json` changes require a full theme push to take effect
- Global settings use `settings.id` in Liquid; section settings use `section.settings.id`
- Never delete a setting ID that is already in use — it will reset saved values for all merchants
- Always backup `config/settings_data.json` before making schema changes
