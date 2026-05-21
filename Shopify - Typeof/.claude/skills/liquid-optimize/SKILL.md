---
name: liquid-optimize
description: Identifies and fixes inefficient Liquid code including nested loops, unnecessary assigns, redundant renders, and slow-loading patterns in Shopify themes
triggers:
  - optimize liquid
  - liquid optimize
  - liquid is slow
  - slow liquid
  - improve liquid
  - refactor liquid
  - liquid performance
---

# Liquid Optimize Skill

## Steps

1. **Identify files to optimize**
   - Ask which file(s) to optimize or scan all `sections/`, `snippets/`, `layout/`, and `templates/`
   - Prioritize high-traffic files: `theme.liquid`, collection/product templates, cart

2. **Find nested loops**
   - Flag any `{% for %}` loop inside another `{% for %}` loop
   - Suggest flattening data with `assign` before the outer loop
   - Example fix:
     ```liquid
     {%- comment -%} Bad: nested loop {%- endcomment -%}
     {% for collection in collections %}
       {% for product in collection.products %}...{% endfor %}
     {% endfor %}

     {%- comment -%} Better: limit and paginate {%- endcomment -%}
     {% for product in collection.products limit: 8 %}...{% endfor %}
     ```

3. **Find expensive object usage**
   - Flag `all_products['handle']` — loads entire product catalog into memory
   - Flag `collections['handle']` inside loops — use direct variable instead
   - Flag `linklists` accessed repeatedly — assign to variable once
   - Suggest replacing with targeted API calls or metafields where possible

4. **Reduce redundant assigns**
   - Find variables assigned inside loops that could be assigned once outside
   - Find `capture` blocks used for simple string concatenation
   - Find `assign` used multiple times for the same value
   - Example fix:
     ```liquid
     {%- comment -%} Bad: assign inside loop {%- endcomment -%}
     {% for product in collection.products %}
       {% assign currency = cart.currency.symbol %}
     {% endfor %}

     {%- comment -%} Better: assign outside loop {%- endcomment -%}
     {% assign currency = cart.currency.symbol %}
     {% for product in collection.products %}...{% endfor %}
     ```

5. **Optimize render calls**
   - Flag `{% render %}` calls inside loops for snippets that don't need per-item data
   - Suggest moving static renders outside the loop
   - Check for duplicate renders of the same snippet on one page
   - Verify only required variables are passed to `render` (avoid passing entire objects)

6. **Check filter chains**
   - Flag long filter chains that could be simplified
   - Find `| split | join` patterns that cancel each other out
   - Ensure `| escape` is not applied multiple times to the same variable
   - Check `| strip_html | truncate` order (strip first, then truncate)

7. **Optimize conditionals**
   - Replace repeated `{% if %}` checks on the same variable with `{% case %}`
   - Move invariant conditions outside loops
   - Use `{% unless %}` instead of `{% if variable == false %}`
   - Combine conditions with `and`/`or` instead of nesting `{% if %}` blocks

8. **Limit and paginate**
   - Ensure all product/collection loops use `limit:` parameter
   - Verify `{% paginate %}` is used for large collections
   - Flag any loop without a limit on a high-traffic page

9. **Generate optimization report**
   - List each issue with file name and line reference
   - Show before/after code for each fix
   - Estimate impact: High / Medium / Low
   - Apply fixes only after user confirms

## Impact Guide
| Issue | Performance Impact |
|-------|--------------------|
| Nested loops | High |
| `all_products` usage | High |
| `render` inside loop | Medium |
| Assign inside loop | Medium |
| Missing `limit:` on loops | Medium |
| Redundant filter chains | Low |
| Duplicate `render` calls | Low |

## Notes
- Always test with `shopify theme dev` before and after optimizations
- Do not optimize code that is not causing a measurable performance issue
- Liquid runs server-side — even small inefficiencies multiply across many visitors
- Use `{% liquid %}` tag to batch multiple Liquid tags and reduce whitespace output
- Whitespace control (`{%-` and `-%}`) reduces HTML output size — use on all tags
