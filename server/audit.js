const axe = require("axe-core");
const css = require("css");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");

const defaultUrl = "https://audit.local/";
const maxFindings = 25;
const aiDefaultApiUrl = "https://api.openai.com/v1/chat/completions";
const aiDefaultModel = "gpt-4.1-mini";
const severityWeights = {
  high: 15,
  medium: 8,
  low: 3
};

const namedColors = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  yellow: "#ffff00",
  navy: "#000080",
  teal: "#008080",
  purple: "#800080",
  orange: "#ffa500",
  transparent: "transparent"
};

async function auditAccessibility(input) {
  const normalizedInput = normalizeInput(input);
  const html = await loadHtml(normalizedInput);
  const dom = new JSDOM(html, {
    url: normalizedInput.url || defaultUrl,
    pretendToBeVisual: true,
    runScripts: "outside-only"
  });

  const axeViolations = await runAxe(dom.window.document, dom.window);
  const customViolations = runCustomChecks(dom.window.document);
  const baselineFindings = dedupeFindings(axeViolations.concat(customViolations)).slice(0, maxFindings);
  const summary = buildSummary(baselineFindings);
  const aiConfig = getAiConfig();
  const baselineLegalSummary = buildLegalSummary(baselineFindings, summary);
  const ai = await generateAiLayer({
    aiConfig: aiConfig,
    findings: baselineFindings,
    input: normalizedInput,
    summary: summary,
    legalSummary: baselineLegalSummary
  });
  const findings = mergeFindingsWithAi(baselineFindings, ai);
  const legalSummary = mergeLegalSummaryWithAi(baselineLegalSummary, ai);
  const report = buildReport({ findings, summary, input: normalizedInput, legalSummary: legalSummary, ai: ai });

  return {
    scannedAt: new Date().toISOString(),
    source: {
      type: normalizedInput.url ? "url" : "html",
      target: normalizedInput.sourceUrl || normalizedInput.url || "Pasted HTML",
      title: normalizedInput.sourceTitle || "Untitled page"
    },
    summary,
    findings,
    ai,
    report,
    limitations: [
      "This MVP analyzes static DOM and styles. Fully dynamic keyboard traps still need manual testing in-browser.",
      "Contrast detection focuses on inline styles and embedded style tags, not external stylesheets behind authentication.",
      buildAiLimitation(ai)
    ]
  };
}

function normalizeInput(input) {
  if (!input || (!input.url && !input.html)) {
    const error = new Error("Provide either a dashboard URL or HTML markup to audit.");
    error.statusCode = 400;
    throw error;
  }

  return {
    url: input.url ? String(input.url).trim() : "",
    html: input.html ? String(input.html) : "",
    sourceUrl: input.sourceUrl ? String(input.sourceUrl).trim() : "",
    sourceTitle: input.sourceTitle ? String(input.sourceTitle).trim() : ""
  };
}

async function loadHtml(input) {
  if (input.html) {
    return input.html;
  }

  const response = await fetch(input.url, {
    headers: {
      "user-agent": "AI Accessibility Auditor MVP"
    }
  });

  if (!response.ok) {
    const error = new Error("Unable to fetch the target URL for auditing.");
    error.statusCode = 400;
    throw error;
  }

  return response.text();
}

async function runAxe(document, window) {
  window.eval(axe.source);
  const results = await window.axe.run(document, {
    rules: {
      "color-contrast": { enabled: false }
    }
  });

  return results.violations.reduce(function collectViolations(collection, violation) {
    const mappedNodes = violation.nodes.map(function mapNode(node) {
      return createFinding({
        id: violation.id,
        title: violation.help,
        severity: mapImpactToSeverity(violation.impact),
        selector: Array.isArray(node.target) ? node.target.join(" ") : "Unknown target",
        description: node.failureSummary || violation.description,
        guidance: getGuidance(violation.id),
        snippet: getSnippet(violation.id),
        category: "WCAG"
      });
    });

    return collection.concat(mappedNodes);
  }, []);
}

function runCustomChecks(document) {
  const findings = [];
  const styleContext = buildStyleContext(document);

  collectMissingLabels(document, findings);
  collectIconButtons(document, findings);
  collectKeyboardAccessIssues(document, findings);
  collectContrastIssues(document, styleContext, findings);

  return findings;
}

function collectMissingLabels(document, findings) {
  const fields = document.querySelectorAll("input, select, textarea");

  Array.prototype.forEach.call(fields, function inspectField(field) {
    const type = (field.getAttribute("type") || "").toLowerCase();
    if (type === "hidden") {
      return;
    }

    const id = field.getAttribute("id");
    const hasLabel = Boolean(
      field.getAttribute("aria-label") ||
        field.getAttribute("aria-labelledby") ||
        field.getAttribute("title") ||
        (id && document.querySelector('label[for="' + id + '"]')) ||
        closestTag(field, "label")
    );

    if (!hasLabel) {
      findings.push(
        createFinding({
          id: "missing-form-label",
          title: "Form field is missing a programmatic label",
          severity: "high",
          selector: getSelector(field),
          description: "Screen reader users need a label to understand what this field collects.",
          guidance: "Add a visible <label> linked with for/id, or provide aria-label when a visible label is not possible.",
          snippet: '<label for="employee-id">Employee ID</label>\n<input id="employee-id" name="employeeId" />',
          category: "Forms"
        })
      );
    }
  });
}

function collectIconButtons(document, findings) {
  const controls = document.querySelectorAll("button, [role='button']");

  Array.prototype.forEach.call(controls, function inspectControl(control) {
    const text = getText(control);
    const hasName = Boolean(text || control.getAttribute("aria-label") || control.getAttribute("title") || control.getAttribute("aria-labelledby"));

    if (!hasName) {
      findings.push(
        createFinding({
          id: "missing-aria-label",
          title: "Interactive control is missing an accessible name",
          severity: "high",
          selector: getSelector(control),
          description: "Icon-only controls need a readable label for assistive technology.",
          guidance: "Add aria-label or visible text so the control announces its purpose.",
          snippet: '<button aria-label="Open payroll details">...</button>',
          category: "ARIA"
        })
      );
    }
  });
}

function collectKeyboardAccessIssues(document, findings) {
  const clickables = document.querySelectorAll("[onclick], [role='button'], [tabindex]");

  Array.prototype.forEach.call(clickables, function inspectClickable(element) {
    const tagName = element.tagName.toLowerCase();
    const tabindex = element.getAttribute("tabindex");
    const isNative = ["button", "a", "input", "select", "textarea"].indexOf(tagName) >= 0;
    const hasKeyboardHandler = element.getAttribute("onkeydown") || element.getAttribute("onkeypress") || element.getAttribute("onkeyup");

    if (!isNative && element.hasAttribute("onclick") && !hasKeyboardHandler) {
      findings.push(
        createFinding({
          id: "keyboard-navigation",
          title: "Clickable element may not be keyboard accessible",
          severity: "medium",
          selector: getSelector(element),
          description: "Custom controls with mouse handlers often block keyboard-only users.",
          guidance: "Use a native button element or add keyboard handling for Enter and Space.",
          snippet: '<button type="button" onClick={openDialog}>Open employee profile</button>',
          category: "Keyboard"
        })
      );
    }

    if (tabindex && Number(tabindex) > 0) {
      findings.push(
        createFinding({
          id: "positive-tabindex",
          title: "Positive tabindex can create confusing tab order",
          severity: "medium",
          selector: getSelector(element),
          description: "Positive tabindex values often create the kind of focus flow users experience as a keyboard trap.",
          guidance: "Prefer natural DOM order with tabindex=" + '"0"' + " only when needed.",
          snippet: '<button type="button">View payslip</button>',
          category: "Keyboard"
        })
      );
    }
  });
}

function collectContrastIssues(document, styleContext, findings) {
  const elements = document.querySelectorAll("body *");

  Array.prototype.forEach.call(elements, function inspectElement(element) {
    const text = getDirectText(element);
    if (!text || text.length < 3) {
      return;
    }

    const style = resolveStyle(element, styleContext);
    if (!style.color || !style.backgroundColor) {
      return;
    }

    const ratio = getContrastRatio(style.color, style.backgroundColor);
    if (ratio < 4.5) {
      findings.push(
        createFinding({
          id: "color-contrast",
          title: "Text contrast may fail WCAG 2.1 AA",
          severity: ratio < 3 ? "high" : "medium",
          selector: getSelector(element),
          description: "Detected contrast ratio is " + ratio.toFixed(2) + ":1. Normal text should be at least 4.5:1.",
          guidance: "Increase the contrast between text and background for dashboard readability.",
          snippet: ".summary-card {\n  color: #102033;\n  background-color: #ffffff;\n}",
          category: "Contrast"
        })
      );
    }
  });
}

function buildStyleContext(document) {
  const rules = [];
  const styleTags = document.querySelectorAll("style");
  let order = 0;

  Array.prototype.forEach.call(styleTags, function parseStyleTag(styleTag) {
    try {
      const ast = css.parse(styleTag.textContent || "");
      const stylesheetRules = (ast.stylesheet && ast.stylesheet.rules) || [];

      stylesheetRules.forEach(function eachRule(rule) {
        if (rule.type !== "rule" || !Array.isArray(rule.selectors)) {
          return;
        }

        const declarations = extractDeclarations(rule.declarations || []);
        if (!Object.keys(declarations).length) {
          return;
        }

        rule.selectors.forEach(function eachSelector(selector) {
          rules.push({ selector: selector, declarations: declarations, order: order++ });
        });
      });
    } catch (error) {
      order += 1;
    }
  });

  return { rules: rules, cache: new WeakMap() };
}

function extractDeclarations(declarations) {
  return declarations.reduce(function collectStyles(collection, declaration) {
    if (declaration.type !== "declaration") {
      return collection;
    }

    const property = String(declaration.property || "").toLowerCase();
    if (["color", "background", "background-color"].indexOf(property) >= 0) {
      collection[property] = declaration.value;
    }

    return collection;
  }, {});
}

function resolveStyle(element, styleContext) {
  if (styleContext.cache.has(element)) {
    return styleContext.cache.get(element);
  }

  const parentStyle = element.parentElement ? resolveStyle(element.parentElement, styleContext) : { color: "#000000", backgroundColor: "#ffffff" };
  const style = {
    color: parentStyle.color,
    backgroundColor: parentStyle.backgroundColor
  };

  styleContext.rules.forEach(function applyRule(rule) {
    try {
      if (element.matches(rule.selector)) {
        applyDeclarations(style, rule.declarations);
      }
    } catch (error) {
      return;
    }
  });

  applyInlineDeclarations(style, element.getAttribute("style") || "");
  styleContext.cache.set(element, style);
  return style;
}

function applyDeclarations(target, declarations) {
  if (declarations.color) {
    const color = normalizeColorValue(declarations.color);
    if (color) {
      target.color = color;
    }
  }

  if (declarations["background-color"]) {
    const backgroundColor = normalizeColorValue(declarations["background-color"]);
    if (backgroundColor && backgroundColor !== "transparent") {
      target.backgroundColor = backgroundColor;
    }
  }

  if (declarations.background) {
    const background = extractColorFromShorthand(declarations.background);
    if (background && background !== "transparent") {
      target.backgroundColor = background;
    }
  }
}

function applyInlineDeclarations(target, styleAttribute) {
  styleAttribute.split(";").forEach(function eachDeclaration(declaration) {
    const parts = declaration.split(":");
    if (parts.length < 2) {
      return;
    }

    const property = parts[0].trim().toLowerCase();
    const value = parts.slice(1).join(":").trim();
    applyDeclarations(target, { [property]: value });
  });
}

function normalizeColorValue(value) {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim().toLowerCase();
  if (namedColors[trimmed]) {
    return namedColors[trimmed];
  }

  if (trimmed.indexOf("var(") === 0 || trimmed === "inherit" || trimmed === "initial") {
    return null;
  }

  if (trimmed === "transparent") {
    return "transparent";
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return "#" + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3];
  }

  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed;
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map(function normalizePart(part) {
      return Number(part.trim());
    });

    if (parts.length >= 3) {
      return rgbToHex(parts[0], parts[1], parts[2]);
    }
  }

  return null;
}

function extractColorFromShorthand(value) {
  const tokens = String(value).split(/\s+/);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = normalizeColorValue(tokens[index]);
    if (token) {
      return token;
    }
  }

  return null;
}

function rgbToHex(red, green, blue) {
  return "#" + [red, green, blue].map(function toHex(channel) {
    const bounded = Math.max(0, Math.min(255, channel));
    return bounded.toString(16).padStart(2, "0");
  }).join("");
}

function getContrastRatio(foreground, background) {
  const foregroundLuminance = getLuminance(hexToRgb(foreground));
  const backgroundLuminance = getLuminance(hexToRgb(background));
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex) {
  return {
    red: parseInt(hex.slice(1, 3), 16),
    green: parseInt(hex.slice(3, 5), 16),
    blue: parseInt(hex.slice(5, 7), 16)
  };
}

function getLuminance(rgb) {
  const channels = [rgb.red, rgb.green, rgb.blue].map(function transformChannel(channel) {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function buildSummary(findings) {
  const counts = findings.reduce(function countBySeverity(collection, finding) {
    collection.total += 1;
    collection[finding.severity] += 1;
    return collection;
  }, { total: 0, high: 0, medium: 0, low: 0 });

  const score = Math.max(0, 100 - (counts.high * 15) - (counts.medium * 8) - (counts.low * 3));

  return {
    score: score,
    totalFindings: counts.total,
    severityBreakdown: counts,
    verdict: score >= 85 ? "Low legal risk" : score >= 65 ? "Needs remediation" : "High compliance risk",
    estimatedLegalExposure: counts.high >= 3 ? "Elevated" : counts.high > 0 ? "Moderate" : "Lower"
  };
}

function buildReport(data) {
  const sourceLabel = data.input.sourceUrl || data.input.url || "Pasted HTML";
  const legalSummary = data.legalSummary;
  const aiMarkdownLines = buildAiMarkdownSection(data.ai);
  const aiHtmlSection = buildAiHtmlSection(data.ai);
  const markdownLines = [
    "# Accessibility Compliance Report",
    "",
    "Source: " + sourceLabel,
    "Page title: " + (data.input.sourceTitle || "Untitled page"),
    "",
    "Score: " + data.summary.score,
    "Verdict: " + data.summary.verdict,
    "Estimated legal exposure: " + data.summary.estimatedLegalExposure,
    "",
    "## Legal Summary",
    "",
    "- Priority remediation window: " + legalSummary.priorityWindow,
    "- High-risk categories: " + (legalSummary.highRiskCategories.length ? legalSummary.highRiskCategories.join(", ") : "None detected"),
    "- Employee impact statement: " + legalSummary.employeeImpact,
    "- Counsel-facing note: " + legalSummary.counselNote,
    ""
  ].concat(aiMarkdownLines).concat(["", "## Findings"]);

  data.findings.forEach(function appendFinding(finding, index) {
    markdownLines.push((index + 1) + ". [" + finding.severity.toUpperCase() + "] " + finding.title);
    markdownLines.push("   - Selector: " + finding.selector);
    markdownLines.push("   - Issue: " + finding.description);
    markdownLines.push("   - Fix: " + finding.guidance);
  });

  const htmlItems = data.findings.map(function renderFinding(finding) {
    return "<li><strong>[" + finding.severity.toUpperCase() + "] " + escapeHtml(finding.title) + "</strong><p>" + escapeHtml(finding.description) + "</p><p><strong>Selector:</strong> " + escapeHtml(finding.selector) + "</p><p><strong>Fix:</strong> " + escapeHtml(finding.guidance) + "</p></li>";
  }).join("");

  return {
    legal: legalSummary,
    markdown: markdownLines.join("\n"),
    html: "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Accessibility Compliance Report</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#162033}section{margin-bottom:24px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #cdd5df;padding:8px;text-align:left}th{background:#eef3f8}ul{padding-left:20px}</style></head><body><h1>Accessibility Compliance Report</h1><section><p><strong>Source:</strong> " + escapeHtml(sourceLabel) + "</p><p><strong>Page title:</strong> " + escapeHtml(data.input.sourceTitle || "Untitled page") + "</p><p><strong>Score:</strong> " + data.summary.score + "</p><p><strong>Verdict:</strong> " + escapeHtml(data.summary.verdict) + "</p><p><strong>Estimated legal exposure:</strong> " + escapeHtml(data.summary.estimatedLegalExposure) + "</p></section><section><h2>Legal Summary</h2><table><tr><th>Priority remediation window</th><td>" + escapeHtml(legalSummary.priorityWindow) + "</td></tr><tr><th>High-risk categories</th><td>" + escapeHtml(legalSummary.highRiskCategories.length ? legalSummary.highRiskCategories.join(", ") : "None detected") + "</td></tr><tr><th>Employee impact</th><td>" + escapeHtml(legalSummary.employeeImpact) + "</td></tr><tr><th>Counsel note</th><td>" + escapeHtml(legalSummary.counselNote) + "</td></tr></table></section>" + aiHtmlSection + "<section><h2>Findings</h2><ol>" + htmlItems + "</ol></section></body></html>"
  };
}

function getAiConfig() {
  const apiKey = process.env.AI_API_KEY ? String(process.env.AI_API_KEY).trim() : "";
  const apiUrl = process.env.AI_API_URL ? String(process.env.AI_API_URL).trim() : aiDefaultApiUrl;
  const model = process.env.AI_MODEL ? String(process.env.AI_MODEL).trim() : aiDefaultModel;
  const enabled = String(process.env.AI_ENABLED || "true").toLowerCase() !== "false";

  return {
    apiKey: apiKey,
    apiUrl: apiUrl,
    model: model,
    enabled: enabled,
    provider: "openai-compatible"
  };
}

async function generateAiLayer(input) {
  if (!input.aiConfig.enabled) {
    return {
      configured: false,
      applied: false,
      status: "disabled",
      provider: input.aiConfig.provider,
      model: input.aiConfig.model,
      message: "The AI layer is disabled by AI_ENABLED=false."
    };
  }

  if (!input.aiConfig.apiKey) {
    return {
      configured: false,
      applied: false,
      status: "disabled",
      provider: input.aiConfig.provider,
      model: input.aiConfig.model,
      message: "Set AI_API_KEY and optionally AI_API_URL to enable live model-generated remediation."
    };
  }

  try {
    const aiResult = await callAiLayer(input);
    return {
      configured: true,
      applied: true,
      status: "applied",
      provider: input.aiConfig.provider,
      model: input.aiConfig.model,
      generatedAt: new Date().toISOString(),
      executiveSummary: aiResult.executiveSummary || "",
      remediationPlan: Array.isArray(aiResult.remediationPlan) ? aiResult.remediationPlan.slice(0, 5) : [],
      legalSummary: aiResult.legalSummary || {},
      findingEnhancements: Array.isArray(aiResult.findingEnhancements) ? aiResult.findingEnhancements : []
    };
  } catch (error) {
    return {
      configured: true,
      applied: false,
      status: "error",
      provider: input.aiConfig.provider,
      model: input.aiConfig.model,
      message: "The AI provider call failed. Falling back to deterministic guidance.",
      error: error.message
    };
  }
}

async function callAiLayer(input) {
  const response = await fetch(input.aiConfig.apiUrl, {
    method: "POST",
    timeout: 20000,
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + input.aiConfig.apiKey
    },
    body: JSON.stringify({
      model: input.aiConfig.model,
      temperature: 0.2,
      messages: buildAiMessages(input)
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error("AI provider returned " + response.status + ": " + responseText.slice(0, 240));
  }

  const payload = await response.json();
  const message = payload && payload.choices && payload.choices[0] && payload.choices[0].message;
  const rawContent = message && message.content;
  const content = Array.isArray(rawContent) ? rawContent.map(function joinPart(part) {
    return part && part.text ? part.text : "";
  }).join("") : rawContent;
  const parsed = parseAiJsonContent(content);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI provider returned content that could not be parsed as JSON.");
  }

  return parsed;
}

function buildAiMessages(input) {
  const compactFindings = input.findings.slice(0, 10).map(function mapFinding(finding) {
    return {
      matchKey: getFindingMatchKey(finding),
      id: finding.id,
      selector: finding.selector,
      title: finding.title,
      severity: finding.severity,
      category: finding.category,
      description: finding.description,
      existingGuidance: finding.guidance,
      existingSnippet: finding.snippet
    };
  });

  return [
    {
      role: "system",
      content: [
        "You are an accessibility remediation assistant for HR and payroll dashboards.",
        "Use only the supplied findings and context.",
        "Return strict JSON with this shape:",
        "{",
        '  "executiveSummary": string,',
        '  "legalSummary": {"priorityWindow": string, "employeeImpact": string, "counselNote": string},',
        '  "remediationPlan": string[],',
        '  "findingEnhancements": [{"matchKey": string, "guidance": string, "snippet": string, "rationale": string}]',
        "}",
        "Keep remediation actionable and specific.",
        "Do not invent selectors or issues that were not provided."
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        source: {
          target: input.input.sourceUrl || input.input.url || "Pasted HTML",
          title: input.input.sourceTitle || "Untitled page"
        },
        summary: input.summary,
        legalSummary: input.legalSummary,
        findings: compactFindings
      })
    }
  ];
}

function parseAiJsonContent(content) {
  if (!content) {
    return null;
  }

  const trimmed = String(content).trim();
  const direct = safeParseJson(trimmed);
  if (direct) {
    return direct;
  }

  const extracted = extractFirstJsonObject(trimmed);
  return extracted ? safeParseJson(extracted) : null;
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let previous = "";

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"' && previous !== "\\") {
      inString = !inString;
    }

    if (!inString) {
      if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          return text.slice(start, index + 1);
        }
      }
    }

    previous = character;
  }

  return null;
}

function mergeFindingsWithAi(findings, ai) {
  if (!ai || !ai.applied || !Array.isArray(ai.findingEnhancements)) {
    return findings;
  }

  const enhancementMap = ai.findingEnhancements.reduce(function collectEnhancements(collection, enhancement) {
    if (enhancement && enhancement.matchKey) {
      collection[enhancement.matchKey] = enhancement;
    }
    return collection;
  }, {});

  return findings.map(function mapFinding(finding) {
    const enhancement = enhancementMap[getFindingMatchKey(finding)];
    if (!enhancement) {
      return Object.assign({}, finding, {
        guidanceSource: "rules"
      });
    }

    return Object.assign({}, finding, {
      baselineGuidance: finding.guidance,
      baselineSnippet: finding.snippet,
      guidance: enhancement.guidance || finding.guidance,
      snippet: enhancement.snippet || finding.snippet,
      aiRationale: enhancement.rationale || "",
      guidanceSource: "ai"
    });
  });
}

function mergeLegalSummaryWithAi(legalSummary, ai) {
  if (!ai || !ai.applied || !ai.legalSummary) {
    return legalSummary;
  }

  return Object.assign({}, legalSummary, {
    priorityWindow: ai.legalSummary.priorityWindow || legalSummary.priorityWindow,
    employeeImpact: ai.legalSummary.employeeImpact || legalSummary.employeeImpact,
    counselNote: ai.legalSummary.counselNote || legalSummary.counselNote
  });
}

function buildAiMarkdownSection(ai) {
  if (!ai || !ai.applied) {
    return [
      "## AI Remediation Layer",
      "",
      "Status: " + ((ai && ai.message) || "Not configured. Set AI_API_KEY to enable model-generated remediation.")
    ];
  }

  const lines = [
    "## AI Remediation Layer",
    "",
    "Provider: " + ai.provider,
    "Model: " + ai.model,
    "Executive summary: " + ai.executiveSummary,
    ""
  ];

  if (Array.isArray(ai.remediationPlan) && ai.remediationPlan.length) {
    lines.push("### AI Remediation Plan");
    lines.push("");
    ai.remediationPlan.forEach(function appendPlanItem(item, index) {
      lines.push((index + 1) + ". " + item);
    });
  }

  return lines;
}

function buildAiHtmlSection(ai) {
  if (!ai || !ai.applied) {
    return "<section><h2>AI Remediation Layer</h2><p>" + escapeHtml((ai && ai.message) || "Not configured. Set AI_API_KEY to enable model-generated remediation.") + "</p></section>";
  }

  const planItems = (ai.remediationPlan || []).map(function mapPlanItem(item) {
    return "<li>" + escapeHtml(item) + "</li>";
  }).join("");

  return "<section><h2>AI Remediation Layer</h2><p><strong>Provider:</strong> " + escapeHtml(ai.provider) + "</p><p><strong>Model:</strong> " + escapeHtml(ai.model) + "</p><p>" + escapeHtml(ai.executiveSummary || "") + "</p>" + (planItems ? "<h3>AI Remediation Plan</h3><ul>" + planItems + "</ul>" : "") + "</section>";
}

function buildAiLimitation(ai) {
  if (!ai || ai.status === "disabled") {
    return "The live AI remediation layer is not configured. Set AI_API_KEY to generate model-tailored guidance and legal summaries.";
  }

  if (ai.status === "error") {
    return "The live AI remediation layer failed during this scan, so the report fell back to deterministic guidance.";
  }

  return "AI-generated remediation is included in this scan. Review model output before using it in production or legal communications.";
}

function getFindingMatchKey(finding) {
  return finding.id + "|" + finding.selector;
}

function buildLegalSummary(findings, summary) {
  const groupedCategories = findings.reduce(function collectCategories(collection, finding) {
    if (finding.severity === "high") {
      collection.add(finding.category);
    }

    return collection;
  }, new Set());
  const weightedRisk = findings.reduce(function collectRisk(total, finding) {
    return total + severityWeights[finding.severity];
  }, 0);

  return {
    priorityWindow: summary.severityBreakdown.high >= 3 ? "Immediate triage recommended within 7 days" : summary.severityBreakdown.high > 0 ? "Remediate high-severity issues within 30 days" : "Track in normal accessibility backlog",
    highRiskCategories: Array.from(groupedCategories),
    employeeImpact: summary.severityBreakdown.high > 0 ? "Employees using assistive technology may be blocked from completing HR or payroll tasks." : "No high-severity blockers detected in this scan.",
    counselNote: weightedRisk >= 45 ? "Document remediation ownership and preserve this report for compliance follow-up." : "Use this report as supporting evidence for ongoing accessibility monitoring.",
    weightedRiskScore: weightedRisk
  };
}

function getGuidance(ruleId) {
  const guidance = {
    "color-contrast": "Use darker text or a lighter background so body text reaches at least a 4.5:1 contrast ratio.",
    "label": "Associate each control with a visible label and a matching for/id pair.",
    "image-alt": "Add concise alt text that describes the image's purpose to the user.",
    "missing-form-label": "Give each field a programmatic label that describes the expected input.",
    "missing-aria-label": "Ensure icon-only controls expose a descriptive accessible name.",
    "keyboard-navigation": "Use native controls or add keyboard interaction for Enter and Space.",
    "positive-tabindex": "Remove positive tabindex values and rely on DOM order for focus flow."
  };

  return guidance[ruleId] || "Review this WCAG issue and provide a semantic, keyboard-friendly fix.";
}

function getSnippet(ruleId) {
  const snippets = {
    "color-contrast": ".payroll-summary { color: #102033; background: #ffffff; }",
    "missing-form-label": '<label for="tax-status">Tax status</label>\n<select id="tax-status" name="taxStatus"></select>',
    "missing-aria-label": '<button aria-label="Download payroll report">...</button>',
    "keyboard-navigation": '<button type="button" onClick={openBenefitsModal}>Benefits</button>',
    "positive-tabindex": '<div tabindex="0">Focusable summary card</div>'
  };

  return snippets[ruleId] || "<label for=\"field\">Field label</label>\n<input id=\"field\" />";
}

function mapImpactToSeverity(impact) {
  switch (impact) {
    case "critical":
    case "serious":
      return "high";
    case "moderate":
      return "medium";
    default:
      return "low";
  }
}

function createFinding(input) {
  return {
    id: input.id,
    title: input.title,
    severity: input.severity,
    selector: input.selector,
    description: input.description,
    guidance: input.guidance,
    snippet: input.snippet,
    category: input.category
  };
}

function dedupeFindings(findings) {
  const seen = new Set();

  return findings.filter(function filterFinding(finding) {
    const key = [finding.id, finding.selector, finding.description].join("|");
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getSelector(element) {
  if (!element || !element.tagName) {
    return "Unknown selector";
  }

  if (element.id) {
    return "#" + element.id;
  }

  const parts = [];
  let current = element;

  while (current && current.tagName && parts.length < 3) {
    let part = current.tagName.toLowerCase();
    if (current.className && typeof current.className === "string") {
      const className = current.className.trim().split(/\s+/).slice(0, 2).join(".");
      if (className) {
        part += "." + className;
      }
    }
    parts.unshift(part);
    current = current.parentElement;
  }

  return parts.join(" > ");
}

function getText(element) {
  return (element.textContent || "").replace(/\s+/g, " ").trim();
}

function getDirectText(element) {
  return Array.prototype.map.call(element.childNodes || [], function mapNode(node) {
    return node.nodeType === 3 ? node.textContent : "";
  }).join(" ").replace(/\s+/g, " ").trim();
}

function closestTag(element, tagName) {
  let current = element.parentElement;

  while (current) {
    if (current.tagName && current.tagName.toLowerCase() === tagName) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

module.exports = {
  auditAccessibility: auditAccessibility
};