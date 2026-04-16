# AI Accessibility Auditor for HR Platforms

This project is a hackathon MVP for auditing HR and payroll dashboards against common WCAG issues.

## What it does

- Scans a public dashboard URL or pasted HTML markup
- Detects common accessibility issues with axe-core plus custom checks for contrast, labels, and keyboard access risks
- Uses an OpenAI-compatible model to generate live remediation summaries, tailored fixes, and legal-facing notes when configured
- Falls back to deterministic rule-based guidance when the AI provider is not configured or unavailable
- Exports compliance reports as JSON, Markdown, or HTML with a legal-summary section
- Includes a Chrome extension MVP for live auditing of the active tab

## Why this stack

The local environment is running Node 12, so this MVP uses a Node 12-compatible Express server and a static frontend instead of a modern Vite toolchain.

## Run locally

1. Install dependencies with `npm install`
2. Start the app with `npm start`
3. Open `http://localhost:3000`

## Real AI layer

Set these environment variables before starting the app:

- `AI_API_KEY` required for live model calls
- `AI_API_URL` optional, defaults to `https://api.openai.com/v1/chat/completions`
- `AI_MODEL` optional, defaults to `gpt-4.1-mini`
- `AI_ENABLED` optional, set to `false` to disable the AI layer explicitly

Example PowerShell session:

```powershell
$env:AI_API_KEY = "your-key"
$env:AI_MODEL = "gpt-4.1-mini"
npm start
```

When configured, the app keeps the deterministic WCAG scanner as the evidence layer and then calls the model to generate:

- an executive remediation summary
- a prioritized remediation plan
- tailored finding-level fixes and code snippets
- legal-facing summary language for exported reports

## Chrome extension

1. Start the web app so the API is available on `http://localhost:3000`
2. Open Chrome extensions and enable Developer mode
3. Load the `extension` folder as an unpacked extension
4. Open a target HR or payroll page and run the extension popup audit

## Scripts

- `npm start` starts the web server
- `npm run dev` starts the same server for local development
- `npm run check` verifies the audit module loads correctly
- `npm run build` prints a build confirmation for this MVP

## Limitations

- URL scanning works best for public pages or raw HTML. Pages behind authentication or heavy client-side rendering may need pasted HTML.
- Keyboard traps that depend on runtime interaction still require manual testing in a real browser session.
- Contrast analysis is strongest for inline styles and embedded style tags.

## Bonus path

The Chrome extension MVP lives in the `extension` folder and sends the active tab DOM to the local audit API.