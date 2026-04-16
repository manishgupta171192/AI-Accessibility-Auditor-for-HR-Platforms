$testData = @{
    html = "<html><body><h1>HR Dashboard</h1><input></input><button>⚙️</button></body></html>"
    sourceTitle = "Test HR Dashboard"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/audit" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $testData `
    -UseBasicParsing

$result = $response.Content | ConvertFrom-Json

Write-Host "✅ Audit Completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Score: $($result.summary.score)"
Write-Host "Findings: $($result.findings.Count)"
Write-Host "Verdict: $($result.summary.verdict)"
Write-Host ""
Write-Host "🤖 AI Layer Status:" -ForegroundColor Cyan
Write-Host "Configured: $($result.ai.configured)"
Write-Host "Applied: $($result.ai.applied)"
Write-Host "Status: $($result.ai.status)"
Write-Host "Provider: $($result.ai.provider)"
Write-Host "Model: $($result.ai.model)"

if ($result.ai.applied) {
    Write-Host ""
    Write-Host "✅ AI REMEDIATION IS ACTIVE!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Executive Summary:" -ForegroundColor Yellow
    Write-Host $result.ai.executiveSummary
    
    if ($result.ai.remediationPlan -and $result.ai.remediationPlan.Count -gt 0) {
        Write-Host ""
        Write-Host "Remediation Plan:" -ForegroundColor Yellow
        $result.ai.remediationPlan | ForEach-Object { Write-Host "• $_" }
    }
} else {
    Write-Host ""
    Write-Host "⚠️ AI Remediation Not Applied" -ForegroundColor Yellow
    if ($result.ai.message) {
        Write-Host "Reason: $($result.ai.message)"
    }
}
