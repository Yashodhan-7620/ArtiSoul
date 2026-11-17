# Loads the local ArtiSoul database export (db-export/artisoul_dump.sql) into
# a Railway MySQL service, into a database named `artisoul`.
#
# Usage (repo root, PowerShell):
#   npm run railway:import
# It asks for Railway's MYSQL_PUBLIC_URL, e.g.
#   mysql://root:PASSWORD@xxxx.proxy.rlwy.net:12345/railway
# and prints the connection string to give the Cloudflare setup afterwards.

$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\.."
$dump = Join-Path $root 'db-export\artisoul_dump.sql'
if (-not (Test-Path $dump)) { throw "Export not found: $dump" }

$mysql = (Get-Command mysql -ErrorAction SilentlyContinue).Source
if (-not $mysql) {
  $mysql = Get-ChildItem 'C:\Program Files\MySQL\MySQL Server*\bin\mysql.exe' -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $mysql) { throw 'mysql.exe not found. Install MySQL client tools or add them to PATH.' }

$url = Read-Host 'Paste Railway MYSQL_PUBLIC_URL'
if ($url -notmatch '^mysql://([^:]+):([^@]+)@([^:/]+):(\d+)') {
  throw 'That does not look like mysql://user:password@host:port/db'
}
$user = [uri]::UnescapeDataString($Matches[1])
$pass = [uri]::UnescapeDataString($Matches[2])
$hostName = $Matches[3]
$port = $Matches[4]

# Password via environment variable, so it never appears in the process list.
$env:MYSQL_PWD = $pass
$common = @('-h', $hostName, '-P', $port, '-u', $user, '--default-character-set=utf8mb4')

try {
  Write-Host "`n==> Creating database 'artisoul' on Railway" -ForegroundColor Cyan
  & $mysql @common -e "CREATE DATABASE IF NOT EXISTS artisoul CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  if ($LASTEXITCODE) { throw 'Could not connect or create the database (see error above).' }

  Write-Host '==> Importing tables and data (a few seconds)' -ForegroundColor Cyan
  Get-Content -Raw -Encoding UTF8 $dump | & $mysql @common artisoul
  if ($LASTEXITCODE) { throw 'Import failed (see error above).' }

  Write-Host '==> Rows per table on Railway:' -ForegroundColor Cyan
  $tables = 'Users','Shops','Products','ProductMedia','Product360','Orders','ChatConversations','ChatMessages','LiveStreams','Reviews'
  $sql = ($tables | ForEach-Object { "SELECT '$_' AS tbl, COUNT(*) AS row_count FROM $_" }) -join ' UNION ALL '
  & $mysql @common artisoul -t -e $sql
  if ($LASTEXITCODE) { throw 'Verification query failed (see error above).' }
} finally {
  Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}

$conn = $url -replace '/[^/?]*(\?.*)?$', '/artisoul'
Write-Host "`nDone. Give the Cloudflare setup this connection string:" -ForegroundColor Green
Write-Host "  $conn"
Write-Host 'Keep it private: it contains the database password.' -ForegroundColor Yellow
