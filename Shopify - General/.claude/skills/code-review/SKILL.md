---
name: code-review
description: Reviews Shopify theme code for Liquid best practices, accessibility, performance, schema correctness, and security
triggers:
  - code review
  - review code
  - review this
  - check my code
  - review section
  - review template
  - review snippet
---

# Code Review Skill

## Steps

1. **Identify files to review**
   - Ask which file(s) to review or review all recently changed files
   - Prioritize: sections, snippets, templates, layout files

2. **Liquid quality checks**
   - Avoid logic-heavy Liquid — move complexity to JS or metafields
   - Check all variables are guarded: `{% if var %}` before use
   - Confirm `{{ var | escape }}` is used for user-generated content
   - Flag `assign` inside loops (should be outside when possible)
   - Check `capture` blocks are not overused for simple string output
   - Verify `render` is used instead of deprecated `include`

3. **Schema checks**
   - All section settings have `id`, `type`, and `label`
   - Blocks include `{{ block.shopify_attributes }}`
   - Root element includes `id="section-{{ section.id }}"`
   - `presets` array is present
   - No duplicate setting IDs within the schema

4. **Accessibility checks**
   - Images have descriptive `alt` attributes (not empty unless decorative)
   - Interactive elements are keyboard accessible
   - Color contrast meets WCAG AA (4.5:1 for text)
   - `aria-label` used where text label is not visible
   - Links have descriptive text (not "click here" or "read more")
   - `<button>` used for actions, `<a>` used for navigation

5. **Performance checks**
   - No synchronous scripts in `<head>`
   - Images use `| image_url` with `width` parameter
   - Below-fold images have `loading="lazy"`
   - No nested loops or `all_products` usage
   - Assets scoped to section using `{% javascript %}` and `{% stylesheet %}`

6. **Security checks**
   - User input is escaped with `| escape` or `| strip_html`
   - No raw HTML output from untrusted metafields without sanitization
   - No hardcoded API keys or tokens in Liquid or JS files
   - External URLs validated before use in `href` or `src`

7. **Naming and structure checks**
   - BEM naming convention used for CSS classes
   - File names are lowercase and hyphenated
   - No inline styles unless dynamically set via Liquid
   - No `!important` in CSS unless absolutely necessary

8. **Generate review report**
   - List issues by category with file and line reference
   - Label each: Critical / Warning / Suggestion
   - Provide corrected code snippets for each issue

## Review Checklist Summary
- [ ] Variables guarded against nil
- [ ] User content escaped
- [ ] `render` used (not `include`)
- [ ] Images optimized with `image_url`
- [ ] `alt` attributes present
- [ ] Keyboard accessible
- [ ] No duplicate schema IDs
- [ ] `block.shopify_attributes` present
- [ ] No hardcoded secrets
- [ ] BEM naming used

## Notes
- Focus on correctness first, then performance, then style
- Do not suggest rewrites unless there is a clear functional issue
- Always explain WHY something is flagged, not just what to change
