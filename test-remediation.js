#!/usr/bin/env node
// Test the AI remediation endpoint

require("dotenv").config();
const fetch = require("node-fetch");

const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Dashboard</title>
</head>
<body>
  <h1>Employee Dashboard</h1>
  
  <!-- Missing label issue -->
  <input type="text" placeholder="Employee ID" />
  
  <!-- Icon button without aria-label -->
  <button>⚙️</button>
  
  <!-- Low contrast -->
  <span style="color: #888; background: #999;">Low contrast text</span>
  
  <!-- Missing form label -->
  <select>
    <option>Select Department</option>
  </select>
</body>
</html>
`;

async function testAiRemediation() {
  console.log("🧪 Testing AI Remediation Layer...\n");

  try {
    const response = await fetch("http://localhost:3000/api/audit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        html: testHtml,
        sourceTitle: "HR Dashboard Test"
      })
    });

    if (!response.ok) {
      console.log("❌ API Error:", response.status);
      const text = await response.text();
      console.log(text);
      return;
    }

    const result = await response.json();
    
    console.log("📊 Audit Results:");
    console.log("─".repeat(50));
    console.log("Score:", result.summary.score);
    console.log("Total Findings:", result.summary.totalFindings);
    console.log("Verdict:", result.summary.verdict);
    console.log("");

    console.log("🤖 AI Layer Status:");
    console.log("─".repeat(50));
    console.log("Configured:", result.ai.configured ? "✅ YES" : "❌ NO");
    console.log("Applied:", result.ai.applied ? "✅ YES" : "❌ NO");
    console.log("Status:", result.ai.status);
    console.log("Provider:", result.ai.provider);
    console.log("Model:", result.ai.model);
    
    if (result.ai.message) {
      console.log("\nMessage:", result.ai.message);
    }

    if (result.ai.applied) {
      console.log("\n✅ AI REMEDIATION IS ACTIVE!");
      console.log("");
      console.log("Executive Summary:");
      console.log("─".repeat(50));
      console.log(result.ai.executiveSummary);
      
      if (result.ai.remediationPlan && result.ai.remediationPlan.length > 0) {
        console.log("\nRemediation Plan:");
        console.log("─".repeat(50));
        result.ai.remediationPlan.forEach((item, i) => {
          console.log(`${i + 1}. ${item}`);
        });
      }
    } else {
      console.log("\n❌ AI REMEDIATION NOT ACTIVE");
      console.log("\nReason:", result.ai.message || "Unknown");
      
      console.log("\nTroubleshooting:");
      if (!result.ai.configured) {
        console.log("• API key is not set");
        console.log("• Check .env file for AI_API_KEY");
        console.log("• Run: npm run test-ai");
      }
      if (result.ai.error) {
        console.log("• API Error:", result.ai.error);
        console.log("• Check your API key is valid");
        console.log("• Check your internet connection");
      }
    }

    console.log("\n" + "─".repeat(50));
    console.log("Sample Findings:", result.findings.slice(0, 2).map(f => f.title).join(", "));

  } catch (error) {
    console.log("❌ Connection Error:", error.message);
    console.log("\nMake sure the app is running: npm start");
  }
}

testAiRemediation();
