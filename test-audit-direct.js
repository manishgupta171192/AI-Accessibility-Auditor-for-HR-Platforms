#!/usr/bin/env node
// Simple diagnostic - just check environment and API config

require("dotenv").config();

console.log("🔍 Environment Diagnostic\n");

console.log("Environment Variables:");
console.log("  AI_ENABLED:", process.env.AI_ENABLED || "true (default)");
console.log("  AI_API_KEY:", process.env.AI_API_KEY ? `✅ SET (${process.env.AI_API_KEY.substring(0, 15)}...)` : "❌ NOT SET");
console.log("  AI_API_URL:", process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions (default)");
console.log("  AI_MODEL:", process.env.AI_MODEL || "gpt-4.1-mini (default)");

console.log("\nNow loading audit module...\n");

try {
  const { auditAccessibility } = require("./server/audit");
  console.log("✅ Audit module loaded successfully");
  
  console.log("\nTesting with sample HTML...");
  const testHtml = `<html><body><button>⚙️</button><input /></body></html>`;
  
  auditAccessibility({ html: testHtml, sourceTitle: "Test" }).then(result => {
    console.log("✅ Audit executed");
    console.log("  - Total findings:", result.findings.length);
    console.log("  - AI configured:", result.ai.configured);
    console.log("  - AI applied:", result.ai.applied);
    console.log("  - AI status:", result.ai.status);
    
    if (!result.ai.applied) {
      console.log("  - Message:", result.ai.message);
    } else {
      console.log("  ✅ AI REMEDIATION IS ACTIVE!");
    }
    
    process.exit(0);
  }).catch(err => {
    console.log("❌ Audit error:", err.message);
    process.exit(1);
  });
  
} catch (error) {
  console.log("❌ Failed to load audit module:", error.message);
  process.exit(1);
}
