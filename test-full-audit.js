#!/usr/bin/env node
// Test the exact audit flow including AI layer

require("dotenv").config();

console.log("🧪 Testing Complete Audit Flow with AI Layer\n");

const { auditAccessibility } = require("./server/audit");

const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>HR Dashboard Test</title>
</head>
<body>
  <h1>Employee Payroll Dashboard</h1>
  
  <!-- Issue 1: Missing label -->
  <input type="text" placeholder="Employee ID" />
  
  <!-- Issue 2: Icon button without label -->
  <button>⚙️</button>
  
  <!-- Issue 3: Low contrast -->
  <span style="color: #888; background: #999;">Salary Information</span>
  
  <!-- Issue 4: Missing form label -->
  <select>
    <option>Select Department</option>
  </select>
  
  <p>Department: Finance | Status: Active | Salary: Confidential</p>
</body>
</html>
`;

async function runTest() {
  try {
    console.log("📝 Input:");
    console.log("  HTML length:", testHtml.length, "bytes");
    console.log("  Title: HR Dashboard Test");
    console.log("");

    console.log("⏳ Running audit (this takes 5-15 seconds for AI)...");
    const startTime = Date.now();

    const result = await auditAccessibility({
      html: testHtml,
      sourceTitle: "HR Dashboard Test"
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("✅ Audit completed in " + duration + "s\n");

    // Display summary
    console.log("📊 Audit Summary:");
    console.log("  Score:", result.summary.score);
    console.log("  Total findings:", result.findings.length);
    console.log("  High severity:", result.summary.severityBreakdown.high);
    console.log("  Medium severity:", result.summary.severityBreakdown.medium);
    console.log("  Low severity:", result.summary.severityBreakdown.low);
    console.log("  Verdict:", result.summary.verdict);
    console.log("");

    // Display AI layer status
    console.log("🤖 AI Layer Status:");
    console.log("  Configured:", result.ai.configured ? "✅ Yes" : "❌ No");
    console.log("  Applied:", result.ai.applied ? "✅ Yes" : "❌ No");
    console.log("  Status:", result.ai.status);
    console.log("  Provider:", result.ai.provider);
    console.log("  Model:", result.ai.model);
    
    if (result.ai.error) {
      console.log("  Error:", result.ai.error);
    }
    
    if (result.ai.message) {
      console.log("  Message:", result.ai.message);
    }

    if (result.ai.applied) {
      console.log("\n✅ SUCCESS: AI REMEDIATION IS ACTIVE!\n");

      console.log("📝 Executive Summary:");
      console.log("─".repeat(60));
      console.log(result.ai.executiveSummary);
      console.log("");

      if (result.ai.remediationPlan && result.ai.remediationPlan.length > 0) {
        console.log("🔧 Remediation Plan:");
        console.log("─".repeat(60));
        result.ai.remediationPlan.forEach((step, i) => {
          console.log((i + 1) + ". " + step);
        });
        console.log("");
      }

      if (result.ai.findingEnhancements && result.ai.findingEnhancements.length > 0) {
        console.log("📌 Finding Enhancements (first 3):");
        console.log("─".repeat(60));
        result.ai.findingEnhancements.slice(0, 3).forEach((enhancement) => {
          console.log("• " + enhancement.id);
          if (enhancement.aiGeneratedFix) {
            console.log("  Fix: " + enhancement.aiGeneratedFix.substring(0, 80) + "...");
          }
        });
      }

    } else {
      console.log("\n❌ AI Remediation Not Applied\n");
      
      console.log("Sample Findings (deterministic guidance):");
      console.log("─".repeat(60));
      result.findings.slice(0, 3).forEach((finding, i) => {
        console.log((i + 1) + ". [" + finding.severity.toUpperCase() + "] " + finding.title);
        console.log("   " + finding.guidance);
      });
    }

    console.log("");
    console.log("✅ Test completed successfully");
    process.exit(0);

  } catch (error) {
    console.log("❌ Audit Error:", error.message);
    console.log(error.stack);
    process.exit(1);
  }
}

runTest();
