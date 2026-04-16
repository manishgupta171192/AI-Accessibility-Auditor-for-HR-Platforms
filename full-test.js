#!/usr/bin/env node
/**
 * Complete AI Remediation Test
 * Tests the full chain: dotenv → environment → audit module → API → AI layer
 */

require("dotenv").config();
const fetch = require("node-fetch");
const http = require("http");

console.log("\n" + "=".repeat(60));
console.log("🧪 COMPLETE AI REMEDIATION TEST");
console.log("=".repeat(60) + "\n");

// Step 1: Check environment
console.log("📋 STEP 1: Environment Variables");
console.log("-".repeat(60));
const apiKey = process.env.AI_API_KEY;
const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
const model = process.env.AI_MODEL || "gpt-4.1-mini";
const enabled = String(process.env.AI_ENABLED || "true").toLowerCase() !== "false";

console.log(`✅ AI_ENABLED: ${enabled}`);
console.log(`${apiKey ? "✅" : "❌"} AI_API_KEY: ${apiKey ? `SET (${apiKey.substring(0, 15)}...)` : "NOT SET"}`);
console.log(`✅ AI_API_URL: ${apiUrl}`);
console.log(`✅ AI_MODEL: ${model}`);

if (!apiKey) {
  console.log("\n❌ ERROR: API_KEY not set!");
  process.exit(1);
}

// Step 2: Check server connectivity
console.log("\n📋 STEP 2: Server Connectivity");
console.log("-".repeat(60));

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:3000/api/health", (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

checkServer().then(async (isRunning) => {
  if (isRunning) {
    console.log("✅ Server is running on http://localhost:3000");
  } else {
    console.log("⚠️  Server is not responding");
    console.log("   Start it with: npm start");
    process.exit(1);
  }

  // Step 3: Test audit endpoint
  console.log("\n📋 STEP 3: Test Audit Endpoint");
  console.log("-".repeat(60));

  const testHtml = `
    <!DOCTYPE html>
    <html>
    <body>
      <h1>HR Dashboard</h1>
      <input type="text" placeholder="Employee ID" />
      <button>⚙️</button>
      <span style="color: #888;">Low contrast text</span>
    </body>
    </html>
  `;

  try {
    console.log("Sending audit request...");
    const response = await fetch("http://localhost:3000/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: testHtml,
        sourceTitle: "HR Dashboard Test"
      }),
      timeout: 30000
    });

    if (!response.ok) {
      console.log(`❌ Server returned ${response.status}`);
      const text = await response.text();
      console.log(text.slice(0, 200));
      process.exit(1);
    }

    const result = await response.json();

    console.log("✅ Audit request successful");
    console.log(`   Score: ${result.summary.score}`);
    console.log(`   Findings: ${result.findings.length}`);

    // Step 4: Check AI layer
    console.log("\n📋 STEP 4: AI Layer Status");
    console.log("-".repeat(60));
    console.log(`Configured: ${result.ai.configured ? "✅ YES" : "❌ NO"}`);
    console.log(`Applied: ${result.ai.applied ? "✅ YES" : "❌ NO"}`);
    console.log(`Status: ${result.ai.status}`);
    console.log(`Provider: ${result.ai.provider}`);
    console.log(`Model: ${result.ai.model}`);

    if (result.ai.message) {
      console.log(`Message: ${result.ai.message}`);
    }

    // Step 5: Show results
    console.log("\n📋 STEP 5: Remediation Results");
    console.log("-".repeat(60));

    if (result.ai.applied) {
      console.log("✅ AI REMEDIATION IS ACTIVE!\n");
      console.log("Executive Summary:");
      console.log(result.ai.executiveSummary);

      if (result.ai.remediationPlan && result.ai.remediationPlan.length > 0) {
        console.log("\nRemediation Plan:");
        result.ai.remediationPlan.forEach((item, i) => {
          console.log(`${i + 1}. ${item}`);
        });
      }
    } else {
      console.log("❌ AI Remediation not applied\n");
      console.log("Reason:", result.ai.message || "Unknown");
      console.log("\nTroubleshooting:");
      console.log("1. Check API key is correct: npm run test-ai");
      console.log("2. Restart server: npm start");
      console.log("3. Check internet connection");
    }

    console.log("\n" + "=".repeat(60));
    console.log(result.ai.applied ? "✅ SUCCESS!" : "⚠️  NEEDS ATTENTION");
    console.log("=".repeat(60) + "\n");

    process.exit(result.ai.applied ? 0 : 1);

  } catch (error) {
    console.log("❌ Error:", error.message);
    process.exit(1);
  }
});
