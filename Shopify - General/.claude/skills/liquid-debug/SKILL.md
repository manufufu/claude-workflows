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

## Chrome DevTools MCP
This skill uses the `chrome-devtools` MCP server to verify Liquid rendering in the live browser.

**Key tools:**
| Tool | Use |
|------|-----|
| `list_pages` | Find the target tab — always call this first |
| `select_page` | Switch to the target tab |
| `navigate_page` | Navigate to or reload the preview URL |
| `take_snapshot` | Inspect the rendered DOM — confirm what Liquid actually output |
| `evaluate_script` | Read live DOM state, data attributes, and element content |
| `list_console_messages` | Check for Liquid-related JS errors |
| `take_screenshot` | Confirm the visual output |

**Workflow:**
1. `list_pages` → `select_page` — find the preview tab
2. `navigate_page` — reload after Liquid changes; use `wait_for` before inspecting
3. `take_snapshot` — inspect the rendered HTML to confirm variable output
4. `evaluate_script` — read DOM content to verify data values
5. `take_screenshot` — confirm the visual result

**Rules:**
- Always call `list_pages` first to find the right tab before acting
- Use `take_snapshot` to see what Liquid rendered — never guess at the output
- After removing debug output (e.g. `| json` dumps), reload and re-check with `take_snapshot`

**Before starting:** Make sure Chrome is open with `shopify theme dev` running. If MCP is unavailable, use the browser DevTools Elements panel to inspect rendered HTML manually.

---

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
   - Run `shopify theme dev` and verify via MCP:
     - `navigate_page` → reload after the fix; use `wait_for` before inspecting
     - `take_snapshot` — confirm the rendered HTML is correct
     - `list_console_messages` — confirm zero JS errors
     - `take_screenshot` — confirm the visual output is correct
   - Remove any debug output (`| json` dumps) before pushing to live
   - After removing debug output, reload via `navigate_page` and `take_snapshot` once more to confirm clean render

## Notes
- Never push debug output (`| json`, `{{ all_products }}`) to the live theme
- Use `{% comment %}DEBUG{% endcomment %}` markers to find and remove debug lines later
- Shopify's Liquid is strict — undefined variables return empty string, not errors
