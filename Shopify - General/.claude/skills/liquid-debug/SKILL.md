---
name: liquid-debug
description: Debugs Liquid template errors, traces variable output, and identifies rendering issues in Shopify themes
triggers:
  - debug liquid
  - liquid error
  - liquid not working
  - variable is empty
  - section not rendering
  - liquid output wrong
---

# Liquid Debug Skill

## Steps

1. **Identify the problem area**
   - Ask for the error message or describe unexpected behavior
   - Identify which template, section, or snippet is affected

2. **Inspect variable output**
   - Add `{{ variable | json }}` to dump raw variable data
   - Use `{% log variable %}` if using Shopify CLI dev server
   - Check if the object is nil with `{% if variable == blank %}`

3. **Trace the data source**
   - Confirm the correct Liquid object is being used (`product`, `collection`, `cart`, etc.)
   - Check if metafields are accessed correctly: `{{ product.metafields.namespace.key }}`
   - Verify loop variables are scoped correctly inside `{% for %}` blocks

4. **Check schema and settings**
   - Confirm section schema `type` matches what is referenced in Liquid
   - Verify `settings.` prefix is used for section settings
   - Check block settings use `block.settings.` not `settings.`

5. **Common fixes**
   - Missing `{% render %}` tag arguments → pass required variables explicitly
   - Filters applied to nil object → guard with `{% if variable %}`
   - Wrong handle → use `{{ product.handle | json }}` to confirm
   - Asset not loading → use `{{ 'file.css' | asset_url }}` not hardcoded paths

6. **Test the fix**
   - Run `shopify theme dev` and verify in browser
   - Remove any debug output (`| json` dumps) before pushing to live

## Notes
- Never push debug output (`| json`, `{{ all_products }}`) to the live theme
- Use `{% comment %}DEBUG{% endcomment %}` markers to find and remove debug lines later
- Shopify's Liquid is strict — undefined variables return empty string, not errors
