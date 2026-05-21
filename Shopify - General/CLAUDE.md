# Project Overview
Brief description of the Shopify store/app — what it sells, who it's for.

# Tech Stack
- Shopify CLI 3.x
- Language: Liquid, JS, CSS

# Coding Conventions
- Use BEM naming for CSS classes
- Keep Liquid logic minimal — move complexity to JS (Refactor after completing a working logic)
- Never edit `vendor/` files directly
- Always mobile-first CSS

# Environment & Secrets
- Store URL: `your-store.myshopify.com`
- Access token stored in `.env` (never commit)

# Rules for Claude
- Never push directly to live theme
- Always check `settings_schema.json` before adding new settings
- Prefer editing existing sections over creating new ones