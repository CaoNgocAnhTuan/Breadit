param(
  [string]$HostName = $env:PGHOST,
  [string]$Port = $env:PGPORT,
  [string]$UserName = $env:PGUSER,
  [string]$Database = $env:PGDATABASE,
  [string]$Password = $env:PGPASSWORD,
  [string]$DatasetFile = "datasets/humans_v1.sql"
)

$ErrorActionPreference = "Stop"

if (-not $HostName) { $HostName = "localhost" }
if (-not $Port) { $Port = "5433" } # matches docker-compose.yml default mapping
if (-not $UserName) { $UserName = "breadit" }
if (-not $Database) { $Database = "breadit" }
if (-not $Password) { $Password = "breaditpassword" }

if (-not (Test-Path $DatasetFile)) {
  throw "Dataset file not found: $DatasetFile"
}

Write-Host "Importing dataset $DatasetFile into $UserName@$HostName:$Port/$Database"

$env:PGPASSWORD = $Password

& psql `
  -v ON_ERROR_STOP=1 `
  -h $HostName `
  -p $Port `
  -U $UserName `
  -d $Database `
  -f $DatasetFile

Write-Host "Done."

