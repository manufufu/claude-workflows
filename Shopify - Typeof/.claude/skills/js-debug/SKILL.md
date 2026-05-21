---
name: js-debug
description: Debugs JavaScript in Chrome DevTools during Shopify theme development — scopes errors to uncommitted changes, inspects via MCP Chrome, fixes in the IDE, verifies in the browser, and retries up to 5 times before handing off to the user
triggers:
  - debug javascript
  - js not working
  - javascript error
  - console error
  - js debug
  - chrome devtools
  - inspect javascript
  - js feature broken
  - script not running
  - event listener not working
  - function is not defined
  - uncaught error
---

# JS Debug Skill

## Goal
Confirm that a JavaScript feature works correctly in the live dev preview — no console errors, no hardcoded values, and the feature behaves as expected in the browser, without breaking anything else on the page.

---

## Chrome DevTools MCP
This skill uses the `chrome-devtools` MCP server (configured in `.claude/mcp.json`) to interact with Chrome directly. Claude can:
- Navigate to URLs and take screenshots
- Read the browser console for errors and warnings
- Evaluate JavaScript in the live page context
- Monitor network requests

**Before starting:** Make sure Chrome is open and the `chrome-devtools` MCP tools are available. If MCP is unavailable or Chrome is not connected, follow the manual fallback steps marked throughout.

---

## Retry Loop Policy
This skill follows a **fix → verify → retry** loop:
- After each fix attempt, re-check the Chrome console via MCP for remaining errors
- If errors persist, return to the IDE with a revised approach and verify again
- **Maximum 5 attempts.** If the JS error is still present after 5 attempts:
  - Stop immediately — do not revert any changes
  - Leave all edits in place so the user can review the progression
  - Report an attempt summary (see Step 7)

---

## Steps

### 1. Scope the affected files
- Run `git diff --name-only` to identify all uncommitted changed files
- Note all changed JS files (`assets/*.js`) and their related Liquid files (`sections/*.liquid`, `snippets/*.liquid`)
- If no files have uncommitted changes, ask the user which file or feature to debug before proceeding
- Scoping to changed files keeps the debugging focused — do not audit the entire codebase

### 2. Verify the JS file is loaded
Before reading or editing anything, confirm the JS file is actually being served to the browser:
- Check `layout/theme.liquid` for a `<script src="{{ 'filename.js' | asset_url }}" defer></script>` tag
- If the JS is section-scoped, check the section file for a `{% javascript %}` block or inline `<script>` tag
- **Via MCP:** Check the Network tab — confirm the JS file appears in requests on the target page
- If the file is not loaded at all, add the script tag first before debugging further — this is one of the most common root causes of "function is not defined" errors

### 3. Read the console errors
- **Via MCP:** Navigate to the preview URL and read the browser console
  - Capture all errors, warnings, and uncaught exceptions
  - Note the exact message, file name, and line number for each
- If MCP is unavailable: ask the user to paste the error from the Chrome DevTools Console tab
- Ask which interaction triggers the issue (page load, click, scroll, form submit, etc.) if not clear from the error

### 4. Read the relevant JS and Liquid files
- Read the full JS file in `assets/` that controls the affected feature
- Read the related Liquid file (section or snippet) to understand what HTML is being rendered:
  - Check if the HTML element the JS targets is inside an `{% if %}` block that may evaluate to false
  - Check if required `data-*` attributes are present on rendered elements
  - Check that the container element the JS expects actually exists in the output
- Check the JS for:
  - Missing or incorrect DOM selectors
  - Event listeners attached before the DOM is ready
  - Undefined variables or missing `null` checks
  - Race conditions between Liquid-rendered content and JS initialization
  - Missing handling for Shopify Section Events (see Step 5)

### 5. Check Shopify Section Events compatibility
JS in theme sections must handle Shopify's section lifecycle events to work correctly inside the theme editor:
- Confirm the JS listens for `shopify:section:load` to re-initialize when a section is added or reordered in the editor
- Confirm the JS listens for `shopify:section:unload` to clean up event listeners and timers when a section is removed
- If these are missing and the feature is section-scoped, add them:
  ```js
  document.addEventListener('shopify:section:load', (event) => {
    const section = event.target;
    // re-initialize feature within this section
  });

  document.addEventListener('shopify:section:unload', (event) => {
    // clean up listeners, intervals, or state
  });
  ```
- Note: storefront-only behavior may work without these, but the skill should still flag their absence

### 6. Check for hardcoded values
- Scan the JS for hardcoded strings:
  - Product IDs, variant IDs, collection handles
  - URLs (`/products/...`, `/cart`, etc.)
  - Store-specific text strings
  - Magic numbers with no clear meaning
- **For each hardcoded value found:** stop and ask the user before changing it

### 7. Fix → Verify loop (max 5 attempts)

Repeat this cycle until the error is resolved or 5 attempts are exhausted. Track the attempt count.

**Fix (in IDE):**
- Make targeted edits to the JS file in `assets/` (and the related Liquid file if needed)
- Guard all DOM queries with null checks:
  ```js
  const el = document.querySelector('[data-cart-form]');
  if (!el) return;
  ```
- Use `DOMContentLoaded` or `defer` on the script tag if timing is the issue
- Note what was changed in this attempt for the summary

**Verify (via Chrome DevTools MCP):**
1. **Disable cache** — in DevTools Network tab, enable "Disable cache" (keeps it off while DevTools is open)
2. **Hard reload** — reload the page to bypass any cached version of the JS file
3. **Check the Console** — confirm zero JS errors related to the fix
4. **Evaluate the feature** — run JS in the page to confirm the feature's live state:
   ```js
   typeof window.myFeatureInit === 'function'
   ```
5. **Take a screenshot** — confirm the UI looks and behaves correctly
6. **Regression check** — evaluate other features on the same page to confirm nothing was broken by the fix:
   - Check for new errors in the Console that weren't there before
   - Visually confirm adjacent features (cart, nav, modals, etc.) still function

**Manual fallback** (if MCP is unavailable):
1. Open DevTools → Network tab → check "Disable cache"
2. Hard reload with `Ctrl+Shift+R`
3. Check the Console tab — zero errors
4. Check the Sources tab → locate the JS file → set a breakpoint if needed
5. Trigger the feature and confirm it works
6. Manually check adjacent features for regressions

**If errors remain after a fix attempt:** revise the approach and repeat. Go back to Step 4 if a new error suggests a different root cause.

**After 5 failed attempts — stop and retain:**
- Do not revert any changes
- Report to the user:
  > "I've made 5 attempts and the error persists. Here's what was tried:
  > - Attempt 1: [what changed] → [error remained]
  > - Attempt 2: [what changed] → [error remained]
  > - ...
  > All changes are retained. Please review and let me know how to proceed."

### 8. Escalate if unresolved before the attempt limit
- If the error cannot be explained by the code and the attempt limit has not been reached, ask:
  > "I wasn't able to identify the cause. Is there a missing JavaScript file that should be present in `assets/` or loaded via the theme?"
- Wait for the user to confirm or provide the missing file before continuing

### 9. Confirm the fix is complete
The fix is only complete when all of the following are true:
- [ ] Zero JS errors in the Console
- [ ] The feature works as expected in the browser (confirmed via screenshot or manual test)
- [ ] No regressions — other features on the page still work
- [ ] No hardcoded values remain (or all flagged values reviewed and approved by the user)
- [ ] Section Events (`shopify:section:load` / `unload`) are handled if the feature is section-scoped

### 10. Clean up
- Remove any `console.log` or `debugger` statements added during debugging
- Remove any temporary test markup added to Liquid files
- Confirm the final code is clean before pushing to the live theme

---

## Hardcoded Value Policy
| Situation | Action |
|-----------|--------|
| Value is store-specific (ID, handle, URL) | Stop and ask the user |
| Value is a layout constant (e.g., breakpoint `768px`) | Flag for user review |
| Value is a magic number with no clear meaning | Ask the user what it represents |
| Value is a third-party key or token | Never hardcode — move to theme settings or metafields |

---

## Notes
- Always test in Chrome — Shopify's theme editor and storefront can behave differently
- `shopify theme dev` hot-reloads Liquid and CSS but JS changes may require a manual browser refresh
- Never hardcode asset paths — use `<script src="{{ 'your-script.js' | asset_url }}" defer></script>`
- Never push a fix to the live theme until the dev preview is confirmed working
- Regressions introduced by a fix are treated as new bugs and must be resolved before closing
