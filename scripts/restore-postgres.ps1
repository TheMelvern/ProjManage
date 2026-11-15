param(
  [Parameter(Mandatory=$true)][string]$BackupFile,
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin",
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
if (-not $Force) { throw 'Restore is destructive. Specify -Force after verifying your target database and backup.' }
if (-not (Test-Path -LiteralPath $BackupFile)) { throw 'Backup file does not exist.' }
if (-not $DatabaseUrl) { throw 'DATABASE_URL is required.' }
$uri = [uri]$DatabaseUrl
if ($uri.Scheme -notin @('postgresql','postgres')) { throw 'Invalid PostgreSQL URI.' }
$credentials = $uri.UserInfo.Split(':',2)
if ($credentials.Count -ne 2) { throw 'Database URL must include username and password.' }
$user = [uri]::UnescapeDataString($credentials[0])
$password = [uri]::UnescapeDataString($credentials[1])
$database = $uri.AbsolutePath.TrimStart('/')
if (-not $database) { throw 'No database in DATABASE_URL.' }
$pgRestore = Join-Path $PgBin 'pg_restore.exe'
if (-not (Test-Path $pgRestore)) { throw "pg_restore.exe not found at $pgRestore" }
$fullPath = [IO.Path]::GetFullPath($BackupFile)
$checksumFile = $fullPath + '.sha256'
if (-not (Test-Path -LiteralPath $checksumFile)) { throw 'Checksum sidecar missing; refusing unchecked restore.' }
$expected = (Get-Content -LiteralPath $checksumFile -Raw).Trim().ToLowerInvariant()
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $fullPath).Hash.ToLowerInvariant()
if ($expected -ne $actual) { throw 'Backup checksum mismatch. Do not restore this file.' }
Write-Host "Target PostgreSQL host: $($uri.Host), database: $database"
Write-Warning 'This command will drop and recreate database objects. Take a separate backup first.'
$env:PGPASSWORD = $password
try {
  & $pgRestore --clean --if-exists --no-owner --no-privileges --exit-on-error --host $uri.Host --port $uri.Port --username $user --dbname $database $fullPath
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
Write-Host 'Restore completed. Verify data, role privileges, and application smoke tests before reuse.'
