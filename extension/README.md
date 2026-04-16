# Chrome Extension MVP

This folder contains a Manifest V3 Chrome extension for live auditing.

## What it does

1. Captures the current tab DOM and metadata.
2. Sends the rendered page HTML to `http://localhost:3000/api/audit`.
3. Shows score, severity counts, and findings in the popup.
4. Exports the generated legal/compliance report as JSON, Markdown, or HTML.

## Load it

1. Start the main app with `npm start`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose Load unpacked and select this folder.

The popup requires the local API to be running.