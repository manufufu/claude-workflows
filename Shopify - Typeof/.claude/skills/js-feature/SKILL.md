---
name: js-feature
description: Builds a new JavaScript feature in a Shopify theme — detects the active section, scaffolds matching JS and CSS files, wires them to the Liquid section, starts with a static interactive feature, then waits for the user to supply schema and Liquid to make it dynamic
triggers:
  - create js feature
  - new javascript feature
  - add js feature
  - build js feature
  - implement javascript
  - add interactivity
  - js feature
  - create javascript
  - add js to section
  - new js functionality
  - create accordion
  - create slider
  - create tabs
  - create modal
  - create dropdown
---

# JS Feature Skill

## Goal
Build an interactive JavaScript feature scoped to the active Shopify section — starting with hardcoded static content so the interaction can be verified immediately. Once confirmed working, the user supplies schema settings and Liquid variables to make it dynamic. The JS rarely needs to change between phases.

---

## Chrome DevTools MCP
This skill uses the `chrome-devtools` MCP server to verify the feature live in Chrome.

**Key tools:**
| Tool | Use |
|------|-----|
| `list_pages` | Find the target tab — always call this first |
| `select_page` | Switch to the target tab |
| `navigate_page` | Navigate to or reload the preview URL |
| `list_console_messages` | Read all console errors and warnings |
| `evaluate_script` | Verify custom element registration and live state |
| `take_screenshot` | Capture working state and mobile viewport |

**Workflow:**
1. `list_pages` → `select_page` — find the preview tab
2. `navigate_page` — load the page; use `wait_for` before inspecting
3. `list_console_messages` — check for zero errors
4. `evaluate_script` — verify feature state
5. `take_screenshot` — confirm visual result

**Rules:**
- Always call `list_pages` first to find the right tab before acting
- Prefer `evaluate_script` over guessing — verify assumptions in the live page
- After any code change, reload via `navigate_page` and re-check with `list_console_messages`
- Confirm with `take_screenshot` + `list_console_messages` before reporting done

**Before starting:** Make sure Chrome is open with the dev preview tab active. If unavailable, follow the manual fallback steps in Step 5.

---

## Naming Conventions (always follow these)
| Thing | Convention | Example |
|-------|-----------|---------|
| JS class name | PascalCase | `AccordionSection` |
| Custom element tag | kebab-case, must contain a hyphen | `accordion-section` |
| JS filename | matches tag name | `accordion-section.js` |
| CSS filename | matches tag name | `accordion-section.css` |
| `data-*` selectors | kebab-case | `data-accordion-trigger` |

Class name, tag name, and filenames must all derive from the same base — no mismatches.

---

## Steps

### 1. Setup — detect the section and check existing files
- Identify the active section from the open file or user context (e.g., `sections/accordion.liquid`)
- Derive the base name: `accordion.liquid` → `accordion`
- Set file targets:
  - Liquid: `sections/accordion.liquid` (exists)
  - JS: `assets/accordion-section.js` (create if missing)
  - CSS: `assets/accordion-section.css` (create if missing)
- Run `git diff --name-only` to see what is already in progress
- Read the existing section Liquid file in full
- Check `assets/` — if a JS or CSS file already exists, read it and extend it rather than replace it
- Check `layout/theme.liquid` and the section file for existing `<script>` and `<link>` tags to avoid duplicates

---

### 2. Write the Liquid
Plan and write the Liquid changes in one pass:
- Design the custom element wrapper with hardcoded static content — do not use `{{ section.settings.* }}` yet:
  ```liquid
  {{ '[feature-name].css' | asset_url | stylesheet_tag }}
  <script src="{{ '[feature-name].js' | asset_url }}" defer></script>

  <[feature-name] id="[feature-name]-{{ section.id }}">
    <div data-[feature]-item>
      <button data-[feature]-trigger>Hardcoded label one</button>
      <div data-[feature]-panel>Hardcoded content one.</div>
    </div>
    <div data-[feature]-item>
      <button data-[feature]-trigger>Hardcoded label two</button>
      <div data-[feature]-panel>Hardcoded content two.</div>
    </div>
  </[feature-name]>
  ```
- Pass `section.id` as the element `id` at minimum — this is always safe and needed for theme editor targeting
- Use `defer` on the script tag — never hardcode asset paths
- Add `{{ block.shopify_attributes }}` on block elements if blocks are involved
- If any value the JS needs is unclear or ambiguous, ask the user before deciding how to pass it

---

### 3. Write the JavaScript and accessibility together
Create or update `assets/[feature-name].js` — write the complete class including accessibility in one pass using the **custom element class pattern** below.

**Rules:**
- Class name must be PascalCase matching the tag: `[feature-name]` → `[FeatureName]`
- Tag must contain a hyphen — `accordion` alone is invalid, `accordion-section` is valid
- Store element references on `this` in `connectedCallback` — do not re-query in `disconnectedCallback`
- Guard every `this.querySelector` call — if not found, return early
- Use `data-*` selectors only — never select by class name or tag
- Read dynamic values from `this.dataset` or child `dataset` — never hardcode in JS logic
- Wrap registration in `if (!customElements.get('...'))` guard
- No `console.log` or `debugger` in final code
- **Include accessibility in the same pass** — do not add it as a separate step after the fact

**Structure:**
```js
class FeatureName extends HTMLElement {
  connectedCallback() {
    // Store all references on `this` so disconnectedCallback can use them directly
    this.items = Array.from(this.querySelectorAll('[data-feature-item]'));
    if (this.items.length === 0) return;

    // Set initial ARIA state
    this.items.forEach((item) => {
      const trigger = item.querySelector('[data-feature-trigger]');
      const panel = item.querySelector('[data-feature-panel]');
      if (!trigger || !panel) return;

      panel.id = panel.id || `panel-${Math.random().toString(36).slice(2)}`;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', panel.id);
      panel.hidden = true;
    });

    this.onClick = this.handleClick.bind(this);
    this.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    // Use stored reference — do not re-query here
    this.removeEventListener('click', this.onClick);
  }

  handleClick(event) {
    const trigger = event.target.closest('[data-feature-trigger]');
    if (!trigger) return;

    const item = trigger.closest('[data-feature-item]');
    if (!item) return;

    const panel = item.querySelector('[data-feature-panel]');
    if (!panel) return;

    item.hasAttribute('data-open') ? this.close(item, trigger, panel) : this.open(item, trigger, panel);
  }

  open(item, trigger, panel) {
    item.setAttribute('data-open', '');
    trigger.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
  }

  close(item, trigger, panel) {
    item.removeAttribute('data-open');
    trigger.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
  }
}

if (!customElements.get('feature-name')) {
  customElements.define('feature-name', FeatureName);
}
```

**Accessibility checklist (built into this step):**
- `aria-expanded` on triggers — toggled in `open` / `close`
- `aria-controls` on trigger pointing to panel `id`
- `role="region"` on panels where appropriate
- Triggers must be `<button>` elements — keyboard accessible by default

---

### 4. Write the CSS
Create `assets/[feature-name].css` — mobile-first, use attribute selectors for state to match what the JS sets:

```css
/* Custom element block */
[feature-name] { display: block; }

/* Item */
[data-feature-item] { border-bottom: 1px solid #e0e0e0; }

/* Trigger */
[data-feature-trigger] {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 1rem;
  cursor: pointer;
  font-size: 1rem;
}

/* Panel */
[data-feature-panel] { padding: 0 1rem 1rem; }

/* Open state — keyed to what JS sets */
[data-feature-item][data-open] [data-feature-trigger] {
  font-weight: bold;
}

/* Responsive — mobile-first, expand at breakpoint */
@media (min-width: 768px) {
  [data-feature-trigger] { font-size: 1.125rem; }
}
```

---

### 5. Verify in Chrome via MCP
After saving all files:

1. **Confirm `shopify theme dev` is running** — get the preview URL
2. `list_pages` → `select_page` — find the preview tab
3. **Disable cache** — DevTools → Network tab → check "Disable cache"
4. `navigate_page` — reload the page; use `wait_for` before inspecting
5. `list_console_messages` — zero errors, zero warnings
6. `evaluate_script` — confirm the custom element registered:
   ```js
   customElements.get('feature-name') // must return the class, not undefined
   ```
7. **Trigger the feature** — interact and confirm behavior via `evaluate_script`
8. `take_screenshot` — capture working state
9. **Test mobile viewport** — emulate mobile and `take_screenshot` to re-verify
10. `list_console_messages` again — confirm no regressions on the same page

**Manual fallback** (if MCP is unavailable):
1. Chrome → `F12` → Network tab → check "Disable cache" → `Ctrl+Shift+R`
2. Console tab — zero errors
3. Interact with the feature and confirm it works
4. Resize to mobile and re-test
5. Check adjacent features for regressions

---

### 6. Confirm the static feature is complete
- [ ] Zero JS errors or warnings in the Console
- [ ] Feature is interactive and works correctly with hardcoded content
- [ ] Works inside the Shopify theme editor (`connectedCallback` / `disconnectedCallback` handle section lifecycle)
- [ ] Works on desktop and mobile viewports
- [ ] `aria-expanded`, `aria-controls`, and keyboard navigation working
- [ ] All state managed via `data-*` attributes — no hardcoded values in JS logic
- [ ] No `console.log` or `debugger` statements
- [ ] Script and CSS tags use `asset_url` — no hardcoded paths
- [ ] No regressions on the page

---

### 7. Hand off for dynamic content
Once the static feature is confirmed working, inform the user:
> "The static feature is working. Please supply the schema settings and Liquid variables to replace the hardcoded content with dynamic values."

Wait for the user to provide:
- Section schema settings (type, id, label, default)
- Which hardcoded values map to which settings
- Block structure if the feature uses repeatable items

Then replace hardcoded values in Liquid with `{{ section.settings.* }}` or `{{ block.settings.* }}`. Minimize JS changes — only update the JS if the dynamic behavior genuinely requires it (e.g., a setting controls whether multiple items can be open at once).

---

### 8. Handoff to js-debug if errors persist
If console errors appear during verification and cannot be resolved within 2 attempts:
- Switch to the `js-debug` skill for full retry loop handling (up to 5 attempts)
- Do not duplicate the retry logic here

---

## Hardcoded Value Policy
| Situation | Action |
|-----------|--------|
| Static placeholder text / labels | Allowed in the static phase — replaced with Liquid in Step 7 |
| Store-specific value (ID, handle, URL) | Pass via `data-*` attribute from Liquid — never hardcode in JS |
| Setting from section schema | Render into a `data-*` attribute once schema is added |
| Layout constant (breakpoint, z-index) | Flag for user review |
| Third-party key or token | Never in JS — move to theme settings or metafields |
| Ambiguous value | Ask the user before deciding |

---

## Notes
- Always `defer` the script tag — avoids DOM timing issues, keeps the page non-blocking
- `shopify theme dev` hot-reloads Liquid and CSS but JS changes may need a manual browser refresh
- The custom element tag **must contain a hyphen** — browser requirement, not convention
- A feature that works on the storefront but breaks in the theme editor is not complete
- Never push to the live theme until the dev preview is confirmed working
