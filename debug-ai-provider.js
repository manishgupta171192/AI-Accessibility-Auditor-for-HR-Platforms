#!/usr/bin/env node
// Detailed AI provider debugging

require("dotenv").config();
const fetch = require("node-fetch");

async function debugAiProvider() {
  console.log("🔍 AI Provider Call Debugging\n");

  // Check environment
  const apiKey = process.env.AI_API_KEY ? String(process.env.AI_API_KEY).trim() : "";
  const apiUrl = process.env.AI_API_URL ? String(process.env.AI_API_URL).trim() : "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_MODEL ? String(process.env.AI_MODEL).trim() : "gpt-4.1-mini";

  console.log("📋 Configuration:");
  console.log("  API Key:", apiKey ? `✅ SET (${apiKey.substring(0, 15)}...)` : "❌ NOT SET");
  console.log("  API URL:", apiUrl);
  console.log("  Model:", model);
  console.log("");

  if (!apiKey) {
    console.log("❌ ERROR: API_API_KEY not set!");
    process.exit(1);
  }

  // Test 1: Direct API call with simple message
  console.log("🧪 Test 1: Direct API Call");
  console.log("─".repeat(50));

  try {
    const testPayload = {
      model: model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant."
        },
        {
          role: "user",
          content: "Say 'API works' in one sentence."
        }
      ]
    };

    console.log("Request:");
    console.log("  URL:", apiUrl);
    console.log("  Method: POST");
    console.log("  Model:", model);
    console.log("  Auth: Bearer [" + apiKey.substring(0, 15) + "...]");
    console.log("");

    const response = await fetch(apiUrl, {
      method: "POST",
      timeout: 20000,
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + apiKey
      },
      body: JSON.stringify(testPayload)
    });

    console.log("Response Status:", response.status, response.statusText);
    console.log("");

    if (!response.ok) {
      const errorText = await response.text();
      console.log("❌ API Error Response:");
      console.log(errorText.substring(0, 500));
      
      if (response.status === 401) {
        console.log("\n⚠️ 401 Unauthorized - Check your API key!");
        console.log("  • Key might be expired");
        console.log("  • Key might be revoked");
        console.log("  • Key might have wrong permissions");
      } else if (response.status === 429) {
        console.log("\n⚠️ 429 Too Many Requests - Rate limited!");
      } else if (response.status === 400) {
        console.log("\n⚠️ 400 Bad Request - Check request format!");
      }
      
      process.exit(1);
    }

    const data = await response.json();
    console.log("✅ API Call Successful!");
    console.log("");
    console.log("Response Structure:");
    console.log("  • model:", data.model);
    console.log("  • usage.prompt_tokens:", data.usage?.prompt_tokens);
    console.log("  • usage.completion_tokens:", data.usage?.completion_tokens);
    console.log("  • choices[0].message.role:", data.choices?.[0]?.message?.role);
    console.log("");
    console.log("Response Content:");
    console.log("  \"" + (data.choices?.[0]?.message?.content || "").substring(0, 100) + "\"");
    console.log("");

    // Test 2: JSON response test
    console.log("🧪 Test 2: API JSON Response Format");
    console.log("─".repeat(50));

    const jsonTestPayload = {
      model: model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You must respond with ONLY valid JSON, no markdown or other text."
        },
        {
          role: "user",
          content: 'Return this JSON: {"test": "success", "status": "working"}'
        }
      ]
    };

    const jsonResponse = await fetch(apiUrl, {
      method: "POST",
      timeout: 20000,
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + apiKey
      },
      body: JSON.stringify(jsonTestPayload)
    });

    if (jsonResponse.ok) {
      const jsonData = await jsonResponse.json();
      const content = jsonData.choices?.[0]?.message?.content;
      console.log("Raw response:", content);
      
      try {
        const parsed = JSON.parse(content);
        console.log("✅ JSON Parse Successful!");
        console.log("Parsed:", JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log("❌ JSON Parse Failed:", e.message);
        console.log("Content:", content);
      }
    }

    console.log("");
    console.log("✅ All tests passed! API is working correctly.");
    console.log("\nYour AI provider is ready.");

  } catch (error) {
    console.log("❌ Error:", error.message);
    console.log("");
    console.log("Troubleshooting:");
    console.log("  • Check internet connection");
    console.log("  • Check API key is valid");
    console.log("  • Check API endpoint is accessible");
    console.log("  • Check for network/firewall issues");
    process.exit(1);
  }
}

debugAiProvider();
