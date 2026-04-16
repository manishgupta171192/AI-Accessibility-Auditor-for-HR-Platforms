#!/usr/bin/env node
// Test script to verify AI API configuration and connectivity

require("dotenv").config();
const fetch = require("node-fetch");

async function testAiConfiguration() {
  console.log("🔍 Testing AI API Configuration...\n");

  // Check environment variables
  const apiKey = process.env.AI_API_KEY ? String(process.env.AI_API_KEY).trim() : "";
  const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_MODEL || "gpt-4.1-mini";
  const enabled = String(process.env.AI_ENABLED || "true").toLowerCase() !== "false";

  console.log("📋 Configuration Status:");
  console.log("  AI_ENABLED:", enabled ? "✅ true" : "❌ false");
  console.log("  API_KEY set:", apiKey ? "✅ yes" : "❌ no");
  console.log("  API_URL:", apiUrl);
  console.log("  Model:", model);
  console.log("");

  if (!apiKey) {
    console.log("❌ ERROR: AI_API_KEY is not set!");
    console.log("   → Set it in .env file or environment");
    process.exit(1);
  }

  if (!enabled) {
    console.log("⚠️  WARNING: AI layer is disabled (AI_ENABLED=false)");
    process.exit(0);
  }

  // Test API connectivity
  console.log("🌐 Testing API Connectivity...\n");

  try {
    const testResponse = await fetch(apiUrl, {
      method: "POST",
      timeout: 15000,
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: "Say 'Connection successful' in one sentence."
          }
        ],
        temperature: 0.2,
        max_tokens: 50
      })
    });

    console.log("Response Status:", testResponse.status);

    if (testResponse.ok) {
      const data = await testResponse.json();
      console.log("✅ SUCCESS: API connection established!");
      console.log("");
      console.log("Response from AI:");
      console.log("-".repeat(50));
      if (data.choices && data.choices[0]) {
        console.log(data.choices[0].message.content);
      }
      console.log("-".repeat(50));
      console.log("");
      console.log("Your AI Accessibility Auditor is ready to use!");
    } else {
      const errorText = await testResponse.text();
      console.log("❌ API Error " + testResponse.status);
      console.log("Response:", errorText.slice(0, 300));
      
      if (testResponse.status === 401) {
        console.log("\n🔑 Issue: Authentication failed - Invalid API key");
        console.log("   → Check your API_KEY is correct");
        console.log("   → Verify it hasn't expired or been revoked");
      } else if (testResponse.status === 429) {
        console.log("\n⏱️  Issue: Rate limit exceeded");
        console.log("   → Wait a moment and try again");
      } else if (testResponse.status === 404) {
        console.log("\n🔗 Issue: API endpoint not found");
        console.log("   → Check your AI_API_URL is correct");
      }
      process.exit(1);
    }
  } catch (error) {
    console.log("❌ Connection Error:", error.message);
    console.log("");
    console.log("Troubleshooting:");
    console.log("  1. Check internet connection");
    console.log("  2. Verify API_URL is accessible");
    console.log("  3. Ensure API_KEY is correct");
    console.log("  4. Check for network/firewall issues");
    process.exit(1);
  }
}

testAiConfiguration();
