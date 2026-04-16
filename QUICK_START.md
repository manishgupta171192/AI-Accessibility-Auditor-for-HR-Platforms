# Quick Reference - AI Auditor Commands

## Start Applications

```powershell
# Start web server (main interface)
npm start

# Start in dev mode (same as start)
npm run dev

# Test API connection
npm run test-ai

# Verify audit module
npm run check

# Build confirmation
npm run build
```

## Check Configuration

```powershell
# View current settings
# (Open .env file in editor)

# Test if API is connected
npm run test-ai
```

## Common Tasks

### Audit a Dashboard
1. `npm start` → http://localhost:3000
2. Paste HTML or enter URL
3. Click "Audit" → Get results in 5-15 seconds
4. View WCAG issues + AI remediations
5. Export as JSON/Markdown/HTML

### Load Chrome Extension
1. `npm start` (ensures API is running)
2. Chrome → Settings → Extensions
3. Enable "Developer mode" (top right)
4. Load unpacked → select `/extension` folder
5. Open HR dashboard → click extension → "Audit This Page"

### Test API Connection
```powershell
npm run test-ai
# ✅ If you see "Connection successful" → All good!
# ❌ If you see errors → Check .env and API key
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `AI_API_KEY` | OpenAI API key | (required) |
| `AI_API_URL` | Custom AI endpoint | https://api.openai.com/v1/chat/completions |
| `AI_MODEL` | LLM model name | gpt-4.1-mini |
| `AI_ENABLED` | Enable/disable AI | true |

## Edit Configuration

Open `.env` and update:
```bash
# Update API key
AI_API_KEY=sk-your-key-here

# Use different model
AI_MODEL=gpt-4-turbo

# Use custom provider  
AI_API_URL=https://your-llm-endpoint.com/v1/chat/completions

# Disable AI (rule-based only)
AI_ENABLED=false
```

Then restart: `npm start`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No API key found" | Check `.env` has `AI_API_KEY=sk-...` |
| Connection error | Run `npm run test-ai` to diagnose |
| 401 Unauthorized | API key expired - get new one from OpenAI |
| Slow responses | Normal (5-15s) - AI is thinking! |
| No remediations | Run `npm run test-ai` to verify setup |

## File Structure

```
.env                   ← Your API key (keep secret!)
.env.example           ← Template (safe to share)
server/
  index.js             ← Web server (loads .env here)
  audit.js             ← Audit logic (uses AI config)
public/
  index.html           ← Web UI
  app.js               ← Frontend logic
extension/
  popup.html           ← Chrome extension UI
test-ai-config.js      ← Connection tester
```

## Get Help

```powershell
# Check API works
npm run test-ai

# Check audit module works
npm run check

# View all available commands
npm run
```

---

**Status**: ✅ Ready to audit HR dashboards with AI!
