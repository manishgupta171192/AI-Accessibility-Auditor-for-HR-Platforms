const apiUrl = "http://localhost:3000/api/audit";
const runButton = document.getElementById("run-audit");
const statusNode = document.getElementById("status");
const summaryNode = document.getElementById("summary");
const findingsNode = document.getElementById("findings");
const exportsNode = document.getElementById("exports");
const exportJsonButton = document.getElementById("export-json");
const exportMarkdownButton = document.getElementById("export-markdown");
const exportHtmlButton = document.getElementById("export-html");

let lastResult = null;

runButton.addEventListener("click", async function auditActiveTab() {
  setBusy(true, "Collecting active tab content...");
  findingsNode.innerHTML = "";
  summaryNode.innerHTML = "";
  exportsNode.classList.add("hidden");

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }

    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function collectDocumentSnapshot() {
        return {
          html: document.documentElement.outerHTML,
          sourceUrl: window.location.href,
          sourceTitle: document.title || "Untitled page"
        };
      }
    });

    const payload = injected && injected[0] ? injected[0].result : null;
    if (!payload || !payload.html) {
      throw new Error("Unable to read page content from the active tab.");
    }

    statusNode.textContent = "Running audit against local API...";
    const response = await fetch(apiUrl, {
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
    renderResult(data);
    exportsNode.classList.remove("hidden");
  } catch (error) {
    lastResult = null;
    statusNode.textContent = error.message || "Audit failed.";
  } finally {
    setBusy(false);
  }
});

exportJsonButton.addEventListener("click", function onExportJson() {
  if (lastResult) {
    downloadFile("extension-compliance-report.json", JSON.stringify(lastResult, null, 2), "application/json");
  }
});

exportMarkdownButton.addEventListener("click", function onExportMarkdown() {
  if (lastResult) {
    downloadFile("extension-compliance-report.md", lastResult.report.markdown, "text/markdown");
  }
});

exportHtmlButton.addEventListener("click", function onExportHtml() {
  if (lastResult) {
    downloadFile("extension-compliance-report.html", lastResult.report.html, "text/html");
  }
});

function renderResult(data) {
  statusNode.textContent = data.summary.verdict + " for " + data.source.target;
  summaryNode.innerHTML = [
    renderCard("Score", data.summary.score),
    renderCard("High", data.summary.severityBreakdown.high),
    renderCard("Medium", data.summary.severityBreakdown.medium),
    renderCard("Exposure", data.summary.estimatedLegalExposure)
  ].join("");

  findingsNode.innerHTML = data.findings.slice(0, 8).map(function renderFinding(finding) {
    return [
      '<article class="finding">',
      '  <span class="badge ' + escapeHtml(finding.severity) + '">' + escapeHtml(finding.severity) + '</span>',
      '  <h2>' + escapeHtml(finding.title) + '</h2>',
      '  <p><strong>Selector:</strong> ' + escapeHtml(finding.selector) + '</p>',
      '  <p>' + escapeHtml(finding.guidance) + '</p>',
      '</article>'
    ].join("\n");
  }).join("");
}

function renderCard(label, value) {
  return '<div class="card"><strong>' + escapeHtml(String(value)) + '</strong><span>' + escapeHtml(label) + '</span></div>';
}

function setBusy(isBusy, message) {
  runButton.disabled = isBusy;
  if (message) {
    statusNode.textContent = message;
  }
}

function getActiveTab() {
  return new Promise(function resolveActiveTab(resolve, reject) {
    chrome.tabs.query({ active: true, currentWindow: true }, function onTabs(tabs) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(tabs[0]);
    });
  });
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type: type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}