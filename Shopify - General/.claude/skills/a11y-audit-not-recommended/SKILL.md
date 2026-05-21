---
name: a11y-audit
description: Crawls the Shopify storefront starting from the home page — following links two levels deep — and runs a full axe-core accessibility audit on every unique page found, then generates a prioritized report grouped by issue and page. Uses Chrome CDP directly via Node.js — no MCP dependency.
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

## How it works
This skill uses **Chrome DevTools Protocol (CDP) directly via Node.js** — no MCP server required. It connects to Chrome on port 9222, crawls the store 2 levels deep from the home page, injects axe-core WCAG 2.1 AA into every page, and saves a styled **HTML report + PDF** to a named output folder (e.g. `syntax-dev-audit/`) with violations mapped to Shopify theme files.

**Requirements:**
- Node.js installed (any modern version with native WebSocket — v22+)
- Chrome installed at the standard path

---

## Steps

### 1. Parse arguments

URL and password come from command arguments — do not ask the user if they were passed:
- Arg 1: store base URL (e.g. `https://your-store.myshopify.com/`)
- Arg 2: storefront password (if the store is password-protected)

---

### 2. Pre-flight — ensure Chrome is running on port 9222

Run this PowerShell block at the start of every audit. It checks if Chrome is already up; if not, kills any stale Chrome and relaunches with remote debugging enabled.

```powershell
# 2a — check if port 9222 is already active
$ready = $false
try {
  $r = Invoke-WebRequest -Uri "http://localhost:9222/json/version" -UseBasicParsing -TimeoutSec 3
  Write-Host "Chrome already running: $(($r.Content | ConvertFrom-Json).Browser)"
  $ready = $true
} catch {}

# 2b — launch Chrome if not ready
if (-not $ready) {
  Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2

  # find Chrome
  $chromePath = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1

  if (-not $chromePath) { Write-Host "ERROR: Chrome not found"; exit 1 }

  $tmpDir = "$env:TEMP\chrome-debug-profile"
  New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

  Start-Process $chromePath -ArgumentList `
    "--remote-debugging-port=9222",
    "--user-data-dir=$tmpDir",
    "--incognito",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"

  Start-Sleep -Seconds 5

  try {
    $r = Invoke-WebRequest -Uri "http://localhost:9222/json/version" -UseBasicParsing -TimeoutSec 5
    Write-Host "Chrome launched: $(($r.Content | ConvertFrom-Json).Browser)"
  } catch {
    Write-Host "FAILED: Chrome did not start on port 9222"; exit 1
  }
}
```

Chrome launched with `--incognito` gives a clean, cookie-free session. Port 9222 stays active until Chrome is closed — subsequent runs skip the launch and proceed immediately.

---

### 3. Locate the audit script

The audit script is bundled with this skill. Do **not** write or copy it to the project root. Use it directly from its location inside the skill folder:

```
.claude/skills/a11y-audit-not-recommended/scripts/a11y-audit.mjs
```

---

### 4. Run the audit

```powershell
cd "C:\Users\Aldrin\Desktop\Claude\Shopify"
node ".claude/skills/a11y-audit-not-recommended/scripts/a11y-audit.mjs" "STORE_URL" "STORE_PASSWORD"
```

Replace `STORE_URL` and `STORE_PASSWORD` with the values from the arguments. If no password was supplied, omit the second argument.

The script will:
1. Connect to Chrome on port 9222
2. Navigate to the store home page and authenticate if a password gate is detected
3. Collect all internal links (2 levels deep, capped at 40/level, max 5 per template type)
4. Skip social media paths mistakenly treated as relative URLs (`/twitter.com`, `/facebook.com`, etc.)
5. Skip `/customer_authentication/` redirect pages
6. Inject axe-core WCAG 2.1 AA into every page and collect violations
7. Re-authenticate automatically if the session expires mid-crawl
8. **Create an output folder** named `{subdomain}-audit` (e.g. `syntax-dev-audit/`) in the project root
9. Write `report.html` — a self-contained styled report with summary cards, violation sections, and priority fix list
10. Write `report.pdf` — rendered via Chrome CDP `Page.printToPDF` from the HTML file

**Output example:**
```
  Folder : C:\...\Shopify\syntax-dev-audit
  HTML   : C:\...\Shopify\syntax-dev-audit\report.html
  PDF    : C:\...\Shopify\syntax-dev-audit\report.pdf
```

---

### 5. Interpret and present the report

After the script completes, tell the user where the output folder is and present a summary of findings in this order:

1. **Summary** — total violations by severity
2. **Site-wide issues first** — violations on 5+ pages, fix in Liquid templates
3. **Page-specific critical/serious issues** — with selector and file mapping
4. **Priority fix list** — numbered, ordered by severity → frequency → effort

For each violation, map it to the correct Shopify file using the FILE_MAP in the script (also listed in the WCAG Quick Reference below).

---

## WCAG 2.1 AA Quick Reference

| Rule ID | Issue | WCAG | Shopify file |
|---------|-------|------|-------------|
| `image-alt` | `<img>` missing `alt` | 1.1.1 | `snippets/product-card.liquid` |
| `label` | Input has no label | 1.3.1 | `sections/contact-form.liquid` |
| `color-contrast` | Text contrast < 4.5:1 | 1.4.3 | `assets/base.css` |
| `heading-order` | Heading levels skipped | 1.3.1 | `sections/*.liquid` |
| `page-has-heading-one` | No `<h1>` on page | 1.3.1 | `sections/*.liquid` |
| `html-has-lang` | `<html>` missing `lang` | 3.1.1 | `layout/theme.liquid` |
| `document-title` | `<title>` missing or empty | 2.4.2 | `layout/theme.liquid` |
| `link-name` | Link has no text | 2.4.4 | `snippets/*.liquid` |
| `button-name` | Button has no label | 4.1.2 | `snippets/*.liquid` |
| `landmark-one-main` | No `<main>` landmark | 1.3.6 | `layout/theme.liquid` |
| `region` | Content not in landmark | 1.3.6 | `layout/theme.liquid` |
| `skip-link` | No skip navigation | 2.4.1 | `layout/theme.liquid` |
| `focus-visible` | Focus not visible | 2.4.7 | `assets/base.css` |
| `image-redundant-alt` | Alt duplicates visible text | 1.1.1 | `snippets/product-card.liquid` |
| `aria-allowed-role` | Invalid `role` on element | 4.1.2 | `sections/*.liquid` |
| `aria-required-attr` | ARIA role missing required attr | 4.1.2 | `snippets/*.liquid` |

---

## Notes
- **Chrome persists across sessions** — once launched on port 9222 with `Start-Process`, it stays running until closed. The pre-flight in Step 2 detects this and skips the launch on subsequent runs
- **No MCP required** — this skill connects to Chrome directly via CDP over HTTP/WebSocket. The `chrome-devtools` MCP server in `mcp.json` is not used by this skill
- **Social link false positives** — Shopify themes sometimes output footer social links as relative hrefs (e.g. `href="twitter.com"` instead of `https://twitter.com`). The script filters these out by pathname
- **axe-core cannot catch everything** — after fixing Critical/Serious violations, do a manual keyboard-navigation pass (Tab through each page) and test with NVDA (Windows) or VoiceOver (Mac)
- **Script location** — `a11y-audit.mjs` lives in `.claude/skills/a11y-audit-not-recommended/scripts/` and is run directly from there. The HTML report output folder (e.g. `carriagetradeshop-audit/`) is written to the project root (`process.cwd()`), not next to the script. Do not deploy the script to the store
