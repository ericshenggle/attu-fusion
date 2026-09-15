param(
  [string]$ClientHost = '127.0.0.1',
  [int]$ClientPort = 3001
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host 'Building the server...' -ForegroundColor Cyan
npm --prefix (Join-Path $root 'server') run build

$server = Start-Process -FilePath 'npm' -ArgumentList '--prefix', (Join-Path $root 'server'), 'run', 'start:prod' -WorkingDirectory $root -PassThru
try {
  Write-Host 'Attu server: http://127.0.0.1:3000' -ForegroundColor Green
  Write-Host "Attu client: http://${ClientHost}:$ClientPort" -ForegroundColor Green
  npm --prefix (Join-Path $root 'client') run start '--' '--host' $ClientHost '--port' $ClientPort
}
finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
}
