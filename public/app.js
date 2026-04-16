const form = document.getElementById("audit-form");
const urlInput = document.getElementById("url");
const htmlInput = document.getElementById("html");
const sampleButton = document.getElementById("sample-button");
const statusNode = document.getElementById("status");
const summaryNode = document.getElementById("summary");
const aiSummaryNode = document.getElementById("ai-summary");
const findingsNode = document.getElementById("findings");
const limitationsNode = document.getElementById("limitations");
const exportJsonButton = document.getElementById("export-json");
const exportMarkdownButton = document.getElementById("export-markdown");
const exportHtmlButton = document.getElementById("export-html");

let lastResult = null;

sampleButton.addEventListener("click", function loadSampleMarkup() {
  urlInput.value = "";
  htmlInput.value = [
    "<main>",
    "  <style>",
    "    body { color: #a7afb8; background: #ffffff; }",
    "    .summary { color: #b7bec6; background: #ffffff; }",
    "  </style>",
    "  <section class=\"summary\">Payroll overview</section>",
    "  <button><svg aria-hidden=\"true\"></svg></button>",
    "  <div onclick=\"openModal()\">Open employee card</div>",
    "  <form>",
    "    <input id=\"salary\" />",
    "  </form>",
    "</main>"
  ].join("\n");
});

form.addEventListener("submit", async function handleSubmit(event) {
  event.preventDefault();
  statusNode.textContent = "Scanning dashboard for WCAG issues...";
  summaryNode.innerHTML = "";
  aiSummaryNode.innerHTML = "";
  findingsNode.innerHTML = "";
  limitationsNode.innerHTML = "";
  setExportState(false);

  const payload = {
    url: urlInput.value.trim(),
    html: htmlInput.value
  };

  try {
    const response = await fetch("/api/audit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Audit failed.");
    }

    lastResult = data;
    renderResults(data);
    setExportState(true);
  } catch (error) {
    lastResult = null;
    statusNode.textContent = error.message;
  }
});

exportJsonButton.addEventListener("click", function exportJson() {
  if (!lastResult) {
    return;
  }

  downloadFile("compliance-report.json", JSON.stringify(lastResult, null, 2), "application/json");
});

exportMarkdownButton.addEventListener("click", function exportMarkdown() {
  if (!lastResult) {
    return;
  }

  downloadFile("compliance-report.md", lastResult.report.markdown, "text/markdown");
});

exportHtmlButton.addEventListener("click", function exportHtml() {
  if (!lastResult) {
    return;
  }

  downloadFile("compliance-report.html", lastResult.report.html, "text/html");
});

function renderResults(data) {
  statusNode.textContent = data.summary.verdict + " - " + data.summary.totalFindings + " findings detected." + buildAiStatusSuffix(data.ai);

  summaryNode.innerHTML = [
    renderSummaryCard("Accessibility score", data.summary.score, getScoreTone(data.summary.score)),
    renderSummaryCard("High severity", data.summary.severityBreakdown.high, "high"),
    renderSummaryCard("Medium severity", data.summary.severityBreakdown.medium, "medium"),
    renderSummaryCard("Low severity", data.summary.severityBreakdown.low, "low")
  ].join("");

  aiSummaryNode.innerHTML = renderAiSummary(data.ai);

  limitationsNode.innerHTML = data.limitations.map(function renderLimitation(item) {
    return "<p>" + escapeHtml(item) + "</p>";
  }).join("");

  findingsNode.innerHTML = data.findings.map(function renderFinding(finding) {
    return [
      '<article class="finding">',
      '  <div class="finding-header">',
      '    <div>',
      "      <h3>" + escapeHtml(finding.title) + "</h3>",
      "      <p><strong>Selector:</strong> " + escapeHtml(finding.selector) + "</p>",
      "      <p>" + escapeHtml(finding.description) + "</p>",
      "      <p><strong>Plain-English fix:</strong> " + escapeHtml(finding.guidance) + "</p>",
      renderAiFindingNote(finding),
      "    </div>",
      '    <span class="badge ' + escapeHtml(finding.severity) + '">' + escapeHtml(finding.severity) + "</span>",
      "  </div>",
      "  <pre><code>" + escapeHtml(finding.snippet) + "</code></pre>",
      "</article>"
    ].join("\n");
  }).join("");
}

function renderSummaryCard(label, value, tone) {
  return '<div class="summary-card ' + tone + '"><strong>' + escapeHtml(String(value)) + '</strong><span>' + escapeHtml(label) + "</span></div>";
}

function renderAiSummary(ai) {
  if (!ai) {
    return "";
  }

  if (!ai.applied) {
    return [
      '<section class="ai-panel ai-panel-muted">',
      '  <p class="eyebrow">AI layer</p>',
      '  <h3>Model remediation is not active for this scan.</h3>',
      '  <p>' + escapeHtml(ai.message || "Set AI_API_KEY to enable the live remediation layer.") + "</p>",
      "</section>"
    ].join("\n");
  }

  return [
    '<section class="ai-panel">',
    '  <p class="eyebrow">AI layer</p>',
    '  <h3>Live remediation generated by ' + escapeHtml(ai.model) + '.</h3>',
    '  <p>' + escapeHtml(ai.executiveSummary || "") + "</p>",
    renderAiPlan(ai.remediationPlan || []),
    "</section>"
  ].join("\n");
}

function renderAiPlan(remediationPlan) {
  if (!remediationPlan.length) {
    return "";
  }

  return '<ol class="ai-plan">' + remediationPlan.map(function renderItem(item) {
    return "<li>" + escapeHtml(item) + "</li>";
  }).join("") + "</ol>";
}

function renderAiFindingNote(finding) {
  if (finding.guidanceSource !== "ai") {
    return "";
  }

  return '<p class="ai-note"><strong>AI rationale:</strong> ' + escapeHtml(finding.aiRationale || "Tailored remediation generated from the page context and rule details.") + "</p>";
}

function buildAiStatusSuffix(ai) {
  if (!ai) {
    return "";
  }

  if (ai.applied) {
    return " AI remediation enabled.";
  }

  return " AI remediation unavailable.";
}

function getScoreTone(score) {
  if (score >= 85) {
    return "low";
  }

  if (score >= 65) {
    return "medium";
  }

  return "high";
}

function setExportState(enabled) {
  exportJsonButton.disabled = !enabled;
  exportMarkdownButton.disabled = !enabled;
  exportHtmlButton.disabled = !enabled;
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type: type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
  URL.revokeObjectURL(href);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}