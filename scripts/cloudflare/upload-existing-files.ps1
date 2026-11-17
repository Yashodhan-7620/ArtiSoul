# Copies every file in backend\uploads into the R2 bucket, so products created
# before the move to Cloudflare keep their photos, videos and 3D models.
# (The frontend rewrites old http://localhost:5000/uploads/... links to the
# current site, so the same filenames just work.)
#   powershell -ExecutionPolicy Bypass -File scripts\cloudflare\upload-existing-files.ps1

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root

$types = @{
  '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.png' = 'image/png'; '.webp' = 'image/webp'
  '.gif' = 'image/gif'; '.mp4' = 'video/mp4'; '.webm' = 'video/webm'; '.glb' = 'model/gltf-binary'
}

Get-ChildItem (Join-Path $root 'backend\uploads') -File | ForEach-Object {
  $ct = $types[$_.Extension.ToLower()]
  if (-not $ct) { $ct = 'application/octet-stream' }
  Write-Host "Uploading $($_.Name) ($ct)"
  npx wrangler r2 object put "artisoul-uploads/$($_.Name)" --file "$($_.FullName)" --content-type $ct --remote
}
