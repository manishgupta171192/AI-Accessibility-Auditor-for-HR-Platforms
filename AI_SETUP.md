# AI API Configuration Guide

## Quick Start

To enable live model-generated remediation, you need to set up your AI API credentials:

### 1. Create a `.env` file

A `.env` file has been created in the project root. Open it and add your credentials:

```bash
AI_API_KEY=your-api-key-here
```

### 2. Get an API Key

**OpenAI (Recommended):**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy it and paste into `.env`

**Other OpenAI-Compatible Providers:**
- Azure OpenAI
- LocalHost (llama.cpp, ollama, etc.)
- HuggingFace Inference API
- Custom LLM endpoints

### 3. (Optional) Configure API Endpoint

If using a non-OpenAI provider, add:

```bash
AI_API_URL=https://your-provider.com/v1/chat/completions
```

### 4. (Optional) Specify Model

```bash
AI_MODEL=gpt-4.1-mini
```

### 5. Start the Application

```bash
npm start
```

The app will automatically detect your configuration and enable AI-powered remediations.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_API_KEY` | Yes | - | Your API key for the AI provider |
| `AI_API_URL` | No | `https://api.openai.com/v1/chat/completions` | Custom API endpoint |
| `AI_MODEL` | No | `gpt-4.1-mini` | Model name |
| `AI_ENABLED` | No | `true` | Set to `false` to disable AI layer |

## What Happens When Configured

When `AI_API_KEY` is set, the auditor will:

✅ Generate executive remediation summaries  
✅ Create prioritized remediation plans  
✅ Provide tailored finding-level fixes with code snippets  
✅ Produce legal-facing summary language for exported reports  

## What Happens Without Configuration

When `AI_API_KEY` is not set, the auditor will:

✅ Still detect all WCAG accessibility issues  
✅ Provide rule-based remediation guidance  
✅ Export reports with standards-based recommendations  

## PowerShell Example

```powershell
# Set environment variables temporarily for this session
$env:AI_API_KEY = "sk-your-key-here"
$env:AI_MODEL = "gpt-4.1-mini"

# Start the app
npm start
```

## Docker/Container Deployment

When deploying, set environment variables before starting:

```bash
export AI_API_KEY="sk-your-key-here"
export AI_API_URL="https://api.openai.com/v1/chat/completions"
export AI_MODEL="gpt-4.1-mini"

npm start
```

## Troubleshooting

**No remediation suggestions appear?**
- Check that `AI_API_KEY` is set correctly
- Verify the API key has proper permissions
- Check that `AI_ENABLED` is not set to `false`
- Review console logs for API errors

**Getting API errors?**
- Verify your API endpoint is accessible
- Check that your API key is valid and not expired
- Ensure rate limits haven't been exceeded

**Want to disable AI and use only rule-based guidance?**
```bash
$env:AI_ENABLED = "false"
npm start
```
