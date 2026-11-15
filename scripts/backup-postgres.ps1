param(
  [Parameter(Mandatory=$true)][string]$Destination,
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin"
)
$ErrorActionPreference = 'Stop'
if (-not $DatabaseUrl) { throw 'DATABASE_URL must be configured. Load backend/.env securely into the current shell.' }
$uri = [uri]$DatabaseUrl
if ($uri.Scheme -notin @('postgresql','postgres')) { throw 'DATABASE_URL must use PostgreSQL URI format.' }
$credentials = $uri.UserInfo.Split(':',2)
if ($credentials.Count -ne 2) { throw 'Database URL must include a username and password.' }
$user = [uri]::UnescapeDataString($credentials[0])
$password = [uri]::UnescapeDataString($credentials[1])
$database = $uri.AbsolutePath.TrimStart('/')
if (-not $database) { throw 'Database name is missing.' }
$pgDump = Join-Path $PgBin 'pg_dump.exe'
if (-not (Test-Path $pgDump)) { throw "pg_dump.exe not found at $pgDump" }
$fullPath = [IO.Path]::GetFullPath($Destination)
$folder = Split-Path $fullPath -Parent
if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
if (Test-Path $fullPath) { throw "Refusing to overwrite existing backup: $fullPath" }
$env:PGPASSWORD = $password
try {
  & $pgDump -Fc --no-owner --no-privileges --host $uri.Host --port $uri.Port --username $user --dbname $database --file $fullPath
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
if (-not (Test-Path $fullPath) -or (Get-Item $fullPath).Length -lt 100) { throw 'Backup file missing or unexpectedly small.' }
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $fullPath).Hash.ToLowerInvariant()
Set-Content -LiteralPath ($fullPath + '.sha256') -Value $hash -Encoding ascii
Write-Host ("Backup saved and SHA-256 recorded: " + $fullPath)
