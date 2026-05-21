---
name: performance-check
description: Audits Shopify theme performance by identifying render-blocking assets, large images, inefficient Liquid, and slow-loading resources
triggers:
  - performance check
  - theme is slow
  - page speed
  - optimize performance
  - slow loading
  - lighthouse score
  - core web vitals
---

# Performance Check Skill

## Scope
- Run `git diff --name-only` to get the list of uncommitted changed files
- If there are no uncommitted changes, stop and inform the user: "No uncommitted changes found. Make some edits first, then run /performance-check."
- Audit the changed files AND any files directly related to them:
  - If a `sections/*.liquid` changed → also audit its linked `assets/section-name.css` and `assets/section-name.js`
  - If an `assets/*.js` or `assets/*.css` changed → also audit the section or snippet that loads it
  - If `layout/theme.liquid` changed → also audit all globally loaded assets referenced in it
  - If a `snippets/*.liquid` changed → also audit every file that calls `{% render 'snippet-name' %}`
  - If a `templates/*.json` changed → also audit the sections referenced inside it
- Do not expand scope beyond directly related files — stay focused on the change and its immediate dependencies

## Steps

1. **Check asset loading**
   - Look for render-blocking CSS/JS in `layout/theme.liquid`
   - Ensure non-critical JS uses `defer` or `async` attributes
   - Verify CSS is loaded with `rel="preload"` where appropriate
   - Check for unused CSS/JS files in `assets/`

2. **Audit images**
   - Confirm all images use `| image_url` with explicit `width` parameter
   - Check that `loading="lazy"` is set on below-the-fold images
   - Verify hero/banner images use `loading="eager"` and `fetchpriority="high"`
   - Look for raw `<img src="">` tags missing `widthxheight` attributes (causes CLS)

3. **Inspect Liquid efficiency**
   - Find `{% for %}` loops inside other `{% for %}` loops (nested loops)
   - Check for `all_products` object usage — it loads entire catalog
   - Look for `{% render %}` calls inside loops — move outside when possible
   - Verify `paginate` is used on collections (never loop all products unpaginated)

4. **Review third-party scripts**
   - List all external scripts loaded in `theme.liquid` and `checkout.liquid`
   - Flag any scripts loaded synchronously in `<head>`
   - Check if chat widgets, reviews apps, or pixel scripts are deferred

5. **Check font loading**
   - Verify Google Fonts or custom fonts use `font-display: swap`
   - Confirm font files are preloaded with `<link rel="preload">`
   - Flag more than 2-3 font families as a performance risk

6. **Section and block audit**
   - Check if inactive/hidden sections still load their assets
   - Look for CSS/JS loaded unconditionally that should be section-scoped
   - Verify `{% javascript %}` and `{% stylesheet %}` tags are used inside sections

7. **Generate report**
   - Summarize findings by severity: Critical / Warning / Suggestion
   - Provide specific file and line references for each issue
   - Suggest fixes with code examples where applicable

## Severity Guide
| Level | Example |
|-------|---------|
| Critical | Render-blocking JS in `<head>`, unoptimized hero image |
| Warning | Nested Liquid loops, synchronous third-party scripts |
| Suggestion | Unused assets, missing lazy loading on below-fold images |

## Notes
- Always test with `shopify theme dev` before and after changes
- Use Google PageSpeed Insights or Shopify's built-in speed score to benchmark
- Target Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms
- Never remove scripts without confirming they are truly unused
