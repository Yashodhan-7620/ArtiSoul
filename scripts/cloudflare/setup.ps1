# One-time Cloudflare setup + first deploy for ArtiSoul.
# Run from the repo root in PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\cloudflare\setup.ps1
# Safe to re-run: steps that are already done are skipped.

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root
$config = Join-Path $root 'wrangler.jsonc'
$utf8 = New-Object System.Text.UTF8Encoding($false)  # no BOM - wrangler can't parse one

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

# 1. Dependencies
Step 'Installing npm dependencies (root, backend, frontend)'
npm install --no-audit --no-fund
npm install --prefix backend --no-audit --no-fund
npm install --prefix frontend --no-audit --no-fund

# 2. Log in
Step 'Checking Cloudflare login'
# `wrangler whoami` exits 0 even when logged out, so check what it says.
function LoggedIn { (cmd /c "npx wrangler whoami 2>&1" | Out-String) -match 'You are logged in' }
if (-not (LoggedIn)) {
  Write-Host 'Not logged in - a browser window will open. Log in and click "Allow".'
  cmd /c "npx wrangler login"
  if (-not (LoggedIn)) { throw 'Cloudflare login did not complete. Run "npx wrangler login" yourself, then re-run this script.' }
}
Write-Host 'Logged in.'

# 3. R2 bucket for uploads
Step 'Creating R2 bucket "artisoul-uploads" (if missing)'
$buckets = cmd /c "npx wrangler r2 bucket list 2>&1" | Out-String
if ($LASTEXITCODE -ne 0) { Write-Host $buckets; throw 'Could not list R2 buckets (see above).' }
if ($buckets -notmatch 'artisoul-uploads') {
  cmd /c "npx wrangler r2 bucket create artisoul-uploads"
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the R2 bucket (see above). If R2 is not enabled yet, enable it in the Cloudflare dashboard (R2 Object Storage) and re-run.' }
} else { Write-Host 'Already exists.' }

# 4. Hyperdrive -> your hosted MySQL
if ((Get-Content $config -Raw) -match 'REPLACE_WITH_HYPERDRIVE_ID') {
  Step 'Creating Hyperdrive config for MySQL'
  Write-Host 'Enter your HOSTED MySQL connection string (must be reachable from the internet),'
  Write-Host 'e.g. mysql://user:password@host:3306/artisoul'
  $conn = Read-Host 'Connection string'
  $out = cmd /c "npx wrangler hyperdrive create artisoul-db --connection-string=`"$conn`" 2>&1" | Out-String
  Write-Host $out
  if ($out -notmatch '([0-9a-f]{32})') { throw 'Could not read the Hyperdrive id from the output above.' }
  $id = $Matches[1]
  [IO.File]::WriteAllText($config, (Get-Content $config -Raw).Replace('REPLACE_WITH_HYPERDRIVE_ID', $id), $utf8)
  Write-Host "Saved Hyperdrive id $id into wrangler.jsonc"
} else { Step 'Hyperdrive id already set in wrangler.jsonc - skipping' }

# 5. Deploy (builds the frontend first, see "build" in wrangler.jsonc)
Step 'Deploying'
npx wrangler deploy
if ($LASTEXITCODE -ne 0) { throw 'wrangler deploy failed' }

# 6. Secrets, copied from backend/.env
Step 'Uploading secrets from backend\.env (JWT_SECRET, TEST_KEY_ID, TEST_KEY_SECRET)'
$secrets = @{}
Get-Content (Join-Path $root 'backend\.env') | ForEach-Object {
  if ($_ -match '^\s*(JWT_SECRET|TEST_KEY_ID|TEST_KEY_SECRET)\s*=\s*(.*)$') {
    $secrets[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}
if (-not $secrets.ContainsKey('JWT_SECRET')) { throw 'JWT_SECRET not found in backend\.env' }
$tmp = New-TemporaryFile
try {
  [IO.File]::WriteAllText($tmp.FullName, ($secrets | ConvertTo-Json), $utf8)
  npx wrangler secret bulk $tmp.FullName
} finally { Remove-Item $tmp -Force }

Step 'Done. Your app URL is printed in the deploy output above (https://artisoul.<you>.workers.dev).'
Write-Host 'Optional: copy existing local uploads to R2 with'
Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\cloudflare\upload-existing-files.ps1'
