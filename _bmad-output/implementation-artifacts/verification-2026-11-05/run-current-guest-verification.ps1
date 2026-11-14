$root='D:\Projects\inquello'
$logs="$root\_bmad-output\implementation-artifacts\verification-2026-11-05"
foreach($name in @('fixture-build-current-guest.log','desktop-build-current-guest.log','visual-smoke-docker-current-guest-clean-1.log','visual-smoke-docker-current-guest-clean-2.log')){if(Test-Path "$logs\$name"){throw "Preserved log exists: $name"}}
Set-Location $root
node -e "const fs=require('fs'),c=require('crypto');const m=JSON.parse(fs.readFileSync('_bmad-output/implementation-artifacts/verification-2026-11-05/progress-repair-final-candidate-manifest.json'));if(m.files.some(x=>c.createHash('sha256').update(fs.readFileSync(x.path)).digest('hex')!==x.sha256))throw new Error('Candidate drift');const r=JSON.parse(fs.readFileSync('.tmp/guest-activation-verified-20261105.json'));if(r.installedVerification!=='PASS'||r.manifest.sourceArchiveSha256!=='9e8f47c61315ccf013a4fbb0616418de2d5c7de69c731ce1e855eff8ce4deeb3'||!r.hostReceiptMatches||!r.directoriesUnchanged)throw new Error('Guest receipt mismatch');"
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
Set-Location "$root\engine\codex-rs"
$env:RUSTUP_HOME='D:\Toolchains\rustup';$env:CARGO_HOME='D:\Toolchains\cargo';$env:TMP='D:\Toolchains\tmp';$env:TEMP=$env:TMP
$env:CARGO_INCREMENTAL='0';$env:CARGO_PROFILE_DEV_DEBUG='0';$env:CARGO_NET_OFFLINE='true'
$env:PATH='D:\Toolchains\rustup\toolchains\1.99.1-x86_64-pc-windows-msvc\bin;D:\Toolchains\cargo\bin;D:\Toolchains\npm-global;'+$env:PATH
cmd /d /c "cargo build --offline --locked -j4 --target-dir D:\Inquello\cache\fixture-20261105 -p codex-app-server --bin codex-app-server --features inference-fixtures > $logs\fixture-build-current-guest.log 2>&1"
$code=$LASTEXITCODE;Write-Output "FIXTURE_BUILD_EXIT=$code";if($code -ne 0){exit $code}
Set-Location "$root\desktop"
cmd /d /c "pnpm build > $logs\desktop-build-current-guest.log 2>&1"
$code=$LASTEXITCODE;Write-Output "DESKTOP_BUILD_EXIT=$code";if($code -ne 0){exit $code}
Set-Location $root
node _bmad-output/implementation-artifacts/verification-2026-11-05/run-docker-verification.cjs D:/Inquello/tmp/epic1-pg-20261105-d778fa3f/ownership.json visual current-guest-clean-1
$code=$LASTEXITCODE;if($code -ne 0){exit $code}
node _bmad-output/implementation-artifacts/verification-2026-11-05/run-docker-verification.cjs D:/Inquello/tmp/epic1-pg-20261105-d778fa3f/ownership.json visual current-guest-clean-2
exit $LASTEXITCODE
