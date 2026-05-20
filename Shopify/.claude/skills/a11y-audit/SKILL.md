---
name: a11y-audit
description: Crawls the Shopify storefront starting from the home page — following links two levels deep — and runs a full axe-core accessibility audit on every unique page found, then generates a prioritized report grouped by issue and page. Opens Chrome in incognito mode and accepts a store URL with password to access password-protected stores.
triggers:
  - a11y audit
  - accessibility audit
  - accessibility check
  - check accessibility
  - wcag
  - audit accessibility
  - screen reader
  - keyboard navigation
  - aria issues
  - alt text audit
---

# A11y Audit Skill

## Goal
Open an incognito Chrome window, authenticate into a password-protected Shopify store using a URL and password provided by the user, crawl every linked page 2 levels deep from the home page, run axe-core WCAG 2.1 AA tests on each page, and produce a consolidated report with violations mapped to Shopify theme files and a prioritized fix list.

---

## Reusable Scripts

### axe-core Injection Script
Inject and run axe-core on the current page via MCP evaluate:

```js
async function runAxe() {
  if (!window.axe) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return await window.axe.run(document, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    resultTypes: ['violations', 'incomplete']
  });
}
runAxe();
```

### Link Collection Script
Extract all unique internal links from the current page via MCP evaluate:

```js
(function collectLinks() {
  const origin = location.origin;
  const skipExts = /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|css|js|woff|woff2|ttf|ico)(\?|$)/i;
  const skipSchemes = /^(mailto:|tel:|javascript:|#)/i;
  return [...new Set(
    [...document.querySelectorAll('a[href]')]
      .map(a => {
        try { return new URL(a.href, origin).href; } catch { return null; }
      })
      .filter(href =>
        href &&
        href.startsWith(origin) &&
        !skipSchemes.test(href) &&
        !skipExts.test(href)
      )
      .map(href => {
        const u = new URL(href);
        u.hash = '';
        u.search = u.searchParams.has('variant') ? u.search : '';
        return u.href;
      })
  )].slice(0, 40);
})();
```

**Limit:** cap at 40 links per level. If a page type (e.g., `/products/`) appears more than 5 times, keep only the first 5 — products share a template so extra entries rarely surface new violations.

### Password Gate Check Script
Detect whether the current page is the Shopify storefront password page:

```js
(function isPasswordPage() {
  return (
    document.querySelector('form[action="/password"]') !== null ||
    document.querySelector('input[name="password"]') !== null ||
    location.pathname === '/password'
  );
})();
```

### Password Submission Script
Fill and submit the password form (replace `STORE_PASSWORD` with the actual value):

```js
(function submitPassword(pwd) {
  const form = document.querySelector('form[action="/password"]');
  const input = form && form.querySelector('input[name="password"], input[type="password"]');
  if (!input) return 'ERROR: password input not found';
  input.value = pwd;
  form.submit();
  return 'submitted';
})('STORE_PASSWORD');
```

---

## Steps

### 1. Collect store URL and password from the user

Ask the user for:
- **Store URL** — the full base URL, e.g. `https://your-store.myshopify.com` or a preview URL like `http://127.0.0.1:9292`
- **Store password** — the storefront password set in Shopify Admin → Online Store → Preferences → Password protection (only needed for password-protected stores)

If the store is public (no password), the password field can be skipped.

Store both values — the password will be passed into the Password Submission Script in Step 3.

---

### 2. Open an incognito Chrome window

Incognito ensures the audit runs with no cached data, no saved cookies, no extensions, and no logged-in session — giving a clean first-visitor view of the store.

**Via Chrome DevTools MCP — create incognito context:**

Use MCP to evaluate the following in any open Chrome tab to open a new incognito window:

```js
// This opens a new incognito window via Chrome extension API if available
window.open('about:blank', '_blank');
```

If the MCP supports browser-context creation (CDP `Target.createBrowserContext`), use that to create a true isolated incognito context before navigating.

**If MCP cannot open incognito programmatically:**
1. Tell the user: "Please press `Ctrl+Shift+N` (Windows) or `Cmd+Shift+N` (Mac) to open a Chrome incognito window."
2. Wait for the user to confirm incognito is open.
3. Continue — the MCP will connect to the active Chrome window, which is now incognito.

**Verify the incognito window is active:**
- Via MCP: take a screenshot — the Chrome toolbar should show the incognito icon (dark background with a spy-hat icon)
- Via MCP evaluate: `document.cookie` should return an empty string on a fresh incognito window (no prior session cookies)

If the window is not incognito, stop and ask the user to open one before continuing.

---

### 3. Navigate to the store and handle the password gate

1. Via MCP: navigate to the store base URL collected in Step 1
2. Wait for the page to load — check `document.readyState === 'complete'` via evaluate
3. Run the **Password Gate Check Script** via evaluate
4. **If the result is `true`** (password page detected):
   - Take a screenshot to confirm the password form is visible
   - Run the **Password Submission Script** with the password from Step 1
   - Wait for navigation to complete (poll `document.readyState`)
   - Take a second screenshot to confirm the home page loaded successfully
   - If still on the password page after submission, stop and ask the user to verify the password is correct
5. **If the result is `false`** (no password gate):
   - The store is public — proceed directly to the crawl
   - Note in the final report that the audit ran on a public (unauthenticated) storefront

---

### 4. Build the crawl queue (Level 0 → Level 1 → Level 2)

**Level 0 — home page:**
- Navigate to the base URL `/` (already loaded after Step 3)
- Run the Link Collection Script via MCP evaluate
- Store results as the **Level 1 queue**

**Level 1 — pages linked from home:**
- For each URL in the Level 1 queue:
  - Navigate to the URL
  - Run the Link Collection Script
  - Add any new URLs (not already seen anywhere) to the **Level 2 queue**
- Apply the 40-link cap and 5-per-template dedup rule at each page

**Level 2 — pages linked from Level 1:**
- The Level 2 queue is all new URLs discovered in the previous step
- Apply the same cap and dedup rules

**Crawl summary:** output the full URL list before starting the audit so the user can confirm scope:
```
Pages to audit (23 total):
  Level 0:  / (home)
  Level 1:  /collections/all, /products/example-product, /pages/about ...
  Level 2:  /collections/sale, /blogs/news/post-title ...
```

---

### 5. Run axe-core audit on each page

For every URL in the full crawl set (Level 0 + 1 + 2):
1. Navigate to the URL via MCP
2. Wait for `document.readyState === 'complete'` via evaluate
3. Run the **axe-core Injection Script** via evaluate
4. Collect from the result:
   - `violations[]` — confirmed failures
   - `incomplete[]` — flagged for manual review
5. For each violation record:
   - `id` — axe rule ID (e.g., `image-alt`, `color-contrast`)
   - `impact` — `critical`, `serious`, `moderate`, or `minor`
   - `description` — what the rule checks
   - `nodes[].target` — CSS selector of the failing element
   - `nodes[].failureSummary` — reason for failure
   - `pageUrl` — the URL this was found on
6. Take a screenshot after each page for visual reference

**If a password redirect happens mid-crawl** (session expired):
- Run the Password Gate Check Script on the current page
- If `true`, re-run the Password Submission Script from Step 3
- Resume the audit from the page that triggered the redirect

**Manual fallback** (if MCP is unavailable):
- Open each URL in Chrome incognito
- Open DevTools → Console tab
- Paste the axe-core Injection Script and run it
- Copy the returned violations array and paste it back into the conversation

---

### 6. Deduplicate and aggregate violations

After all pages are audited:
- Group violations by `rule id`
- For each rule, list every affected page URL and element selector
- Count total occurrences across all pages
- Flag any rule appearing on **5 or more pages** as **site-wide** — likely a template-level issue in a shared Liquid file

---

### 7. Generate the report

```
## Accessibility Audit Report
Store: {base URL}  |  Audited: {N} pages  |  Date: {today}  |  Standard: WCAG 2.1 AA
Session: Incognito Chrome  |  Auth: {Password-protected / Public}

### Summary
| Severity  | Unique Rules | Total Violations |
|-----------|-------------|-----------------|
| Critical  | X           | X               |
| Serious   | X           | X               |
| Moderate  | X           | X               |
| Minor     | X           | X               |

---

### Critical Issues

#### [rule-id] — Rule description
> WCAG criterion: X.X.X | Impact: Critical | Appears on: N pages

**What it means:** plain-language explanation of why this matters for users

**Affected pages and elements:**
- `/page-url` → `CSS selector of failing element`
  Fix: specific code fix or recommendation

---

### Serious Issues
... (same format)

---

### Moderate / Minor Issues
... (same format, condensed)

---

### Incomplete / Needs Manual Review
Items axe flagged as needing human judgment (e.g., color contrast in dynamic content, complex ARIA widget patterns)

---

### Site-Wide Issues (5+ pages)
Template-level fixes — change the Liquid file, not individual pages:
- List the section/snippet/layout file most likely responsible
```

---

### 8. Map violations to Shopify theme files

For each Critical or Serious violation, identify the most likely source file:

| Symptom | Likely file |
|---------|-------------|
| Missing `alt` on product images | `sections/main-product.liquid`, `snippets/product-card.liquid` |
| Missing form labels | `sections/contact-form.liquid`, `snippets/search-form.liquid` |
| Low color contrast | `assets/base.css` or section-specific CSS |
| Missing heading hierarchy | Section layout files, `layout/theme.liquid` |
| Missing `lang` on `<html>` | `layout/theme.liquid` |
| Missing skip link | `layout/theme.liquid` — first focusable element inside `<body>` |
| Broken ARIA references | `snippets/*.liquid`, `sections/*.liquid` |
| Missing page `<title>` | `layout/theme.liquid`, `templates/*.liquid` |
| Inaccessible modal or drawer | `snippets/cart-drawer.liquid`, custom JS components |
| Focus not visible | `assets/base.css` — missing `:focus-visible` styles |

For each mapped violation, show the file path and a suggested Liquid or CSS fix with code.

---

### 9. Prioritized fix list

Output a numbered list ordered by: severity → frequency → effort (easiest first within same severity):

```
Fix priority:
1. [CRITICAL, site-wide]  Add alt attributes to product card images → snippets/product-card.liquid
2. [CRITICAL, 3 pages]    Associate form labels with inputs → sections/contact-form.liquid
3. [SERIOUS, site-wide]   Add skip-to-content link as first element → layout/theme.liquid
4. [SERIOUS, 2 pages]     Fix heading hierarchy (h3 before h2) → sections/featured-collection.liquid
...
```

---

## WCAG 2.1 AA Quick Reference

| Rule ID | Issue | WCAG | Fix |
|---------|-------|------|-----|
| `image-alt` | `<img>` missing `alt` | 1.1.1 | Add descriptive `alt` or `alt=""` for decorative |
| `label` | Input has no label | 1.3.1 | Add `<label for="id">` or `aria-label` |
| `color-contrast` | Text contrast < 4.5:1 | 1.4.3 | Darken text or lighten background |
| `heading-order` | Heading levels skipped | 1.3.1 | Use h1→h2→h3 without gaps |
| `link-name` | Link has no text | 2.4.4 | Add descriptive text or `aria-label` |
| `button-name` | Button has no label | 4.1.2 | Add text content or `aria-label` |
| `html-has-lang` | `<html>` missing `lang` | 3.1.1 | Add `lang="en"` to `<html>` tag |
| `landmark-one-main` | No `<main>` landmark | 1.3.6 | Wrap page content in `<main>` |
| `region` | Content not in landmark | 1.3.6 | Wrap in `<main>`, `<nav>`, `<header>`, etc. |
| `skip-link` | No skip navigation | 2.4.1 | Add `<a href="#main">Skip to content</a>` |
| `focus-visible` | Focus not visible | 2.4.7 | Add `:focus-visible` CSS outline |
| `aria-required-attr` | ARIA role missing required attr | 4.1.2 | Add the required `aria-*` attribute |
| `aria-valid-attr-value` | Invalid ARIA attribute value | 4.1.2 | Fix the attribute value |

---

## Notes
- Incognito removes cached assets and session state — this is the correct environment for an accessibility audit
- The storefront password entered during the audit is only used in the browser session and is never stored or logged
- `axe-core` cannot detect all accessibility issues — after fixing Critical/Serious violations, do a manual keyboard navigation pass (Tab through the page) and test with a screen reader (NVDA on Windows, VoiceOver on Mac)
- Shopify's Dawn theme has known minor violations — focus on Critical and Serious issues first
- Never push accessibility fixes directly to the live theme without testing in the dev preview
- If axe-core takes longer than 10 seconds on a page, add `{ timeout: 15000 }` to the `axe.run` options
- Always audit on the dev preview URL (`shopify theme dev`) rather than the live theme editor URL — the editor adds wrapper markup that can skew results
