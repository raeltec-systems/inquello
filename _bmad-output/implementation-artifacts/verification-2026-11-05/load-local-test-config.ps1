$ErrorActionPreference = 'Stop'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile('D:\Projects\inquello\.tmp\story121-env.ps1', [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'Configuration did not parse; nothing loaded.' }
$assignments = @($ast.FindAll({ param($n)
    $n -is [System.Management.Automation.Language.AssignmentStatementAst] -and
    $n.Left -is [System.Management.Automation.Language.VariableExpressionAst] -and
    $n.Left.VariablePath.UserPath -ieq 'env:INQUELLO_TEST_DATABASE_URL'
}, $true))
if ($assignments.Count -ne 1 -or $assignments[0].Operator.ToString() -ne 'Equals') { throw 'Expected one plain test database assignment.' }
$element = $assignments[0].Right
if ($element -isnot [System.Management.Automation.Language.CommandExpressionAst] -or $element.Redirections.Count -ne 0 -or
    $element.Expression -isnot [System.Management.Automation.Language.StringConstantExpressionAst]) { throw 'Computed configuration refused.' }
$value = $element.Expression.Value
$uri = $null
if (-not [Uri]::TryCreate($value, [UriKind]::Absolute, [ref]$uri)) { throw 'Invalid database configuration.' }
if ($uri.Scheme -notin @('postgres', 'postgresql') -or $uri.Host -ne '127.0.0.1' -or
    $uri.Port -ne 5432 -or $uri.AbsolutePath -ne '/inquello_test' -or
    $uri.Query -ne '' -or $uri.Fragment -ne '') { throw 'Unexpected database destination refused.' }
$parts = $uri.UserInfo -split ':', 2
if ($parts.Count -ne 2) { throw 'Expected local test authentication.' }
$user = [Uri]::UnescapeDataString($parts[0])
$password = [Uri]::UnescapeDataString($parts[1])
if ([string]::IsNullOrWhiteSpace($user) -or [string]::IsNullOrEmpty($password) -or
    $user -match '[\x00-\x1f]' -or $password -match '[\x00-\x1f]') { throw 'Invalid local test authentication.' }
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) { throw 'Installed PostgreSQL client missing.' }
$names = @('PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGCONNECT_TIMEOUT','PGOPTIONS','PGSERVICE','PGSERVICEFILE')
$prior = @{}
foreach ($name in $names) { $prior[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$priorTest = $env:INQUELLO_TEST_DATABASE_URL
$verified = $false
try {
    $env:INQUELLO_TEST_DATABASE_URL = $value
    $env:PGHOST = '127.0.0.1'; $env:PGPORT = '5432'; $env:PGDATABASE = 'inquello_test'
    $env:PGUSER = $user; $env:PGPASSWORD = $password; $env:PGCONNECT_TIMEOUT = '5'
    $env:PGOPTIONS = '-c default_transaction_read_only=on'
    Remove-Item Env:PGSERVICE, Env:PGSERVICEFILE -ErrorAction SilentlyContinue
    $query = "SELECT current_setting('server_version_num'), EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolcreatedb), current_database() = 'inquello_test';"
    $result = @(& $psql -X -w -q -A -t -c $query 2>$null)
    if ($LASTEXITCODE -ne 0 -or $result.Count -ne 1 -or $result[0] -notmatch '^([0-9]{6})\|(t|f)\|(t|f)$') { throw 'Local database connectivity not verified.' }
    $version = [int]$Matches[1]; $createdb = $Matches[2] -eq 't'; $expected = $Matches[3] -eq 't'
    $postgres18 = $version -ge 180000 -and $version -lt 190000
    [pscustomobject]@{ Connected = $true; ServerVersionNumber = $version; PostgreSQL18 = $postgres18; CurrentRoleCanCreateDatabase = $createdb; ExpectedTestDatabase = $expected }
    if (-not ($postgres18 -and $createdb -and $expected)) { throw 'Database prerequisites not satisfied.' }
    $verified = $true
    Remove-Item Env:INQUELLO_DEV_DATABASE_URL -ErrorAction SilentlyContinue
}
finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $prior[$name], 'Process') }
    if (-not $verified) { [Environment]::SetEnvironmentVariable('INQUELLO_TEST_DATABASE_URL', $priorTest, 'Process') }
    $password = $null; $value = $null; $result = $null; $parts = $null; $uri = $null
    $ast = $null; $tokens = $null; $assignments = $null
}
