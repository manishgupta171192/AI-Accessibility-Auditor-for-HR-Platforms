const express = require("express");
const path = require("path");

// Load environment variables from .env file
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { auditAccessibility } = require("./audit");

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "..", "public");

app.use(function allowApiCrossOrigin(request, response, next) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(publicDir));

app.get("/api/health", function handleHealthRequest(request, response) {
  response.json({ ok: true, service: "ai-accessibility-auditor" });
});

app.post("/api/audit", async function handleAuditRequest(request, response) {
  try {
    const result = await auditAccessibility(request.body || {});
    response.json(result);
  } catch (error) {
    response.status(error.statusCode || 400).json({
      error: error.message || "Accessibility audit failed."
    });
  }
});

app.get("*", function serveApp(request, response) {
  response.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, function startServer() {
  console.log("AI Accessibility Auditor running on http://localhost:" + port);
});