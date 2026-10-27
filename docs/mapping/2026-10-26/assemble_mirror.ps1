$ErrorActionPreference = 'Stop'
$researchRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$inventory = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'SOURCE_INVENTORY.json') -Raw | ConvertFrom-Json
$entries = @()
foreach ($part in @('mirror_C01_C26.json', 'mirror_C27_C52.json', 'mirror_C53_C78.json')) {
    $entries += @(Get-Content -LiteralPath (Join-Path $PSScriptRoot $part) -Raw | ConvertFrom-Json)
}
$additions = @(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'PROVIDER_ADDITIONS.json') -Raw | ConvertFrom-Json)
$entries += $additions
$expectedEntries = @($inventory.entries) + $additions
$entries = @($entries | Sort-Object id)
$required = @('id','feature','audit_feature','codex_behavior','trigger','inputs','audit_action','outputs','auditor_control','example','adaptation_boundary','evidence','subfeatures','audit_enhancements')
$failures = @()
foreach ($baseline in $expectedEntries) {
    $matches = @($entries | Where-Object id -eq $baseline.id)
    if ($matches.Count -ne 1) { $failures += "$($baseline.id): expected one mapping"; continue }
    $entry = $matches[0]
    if ($entry.feature -cne $baseline.feature) { $failures += "$($entry.id): feature name differs" }
    foreach ($field in $required) {
        $value = $entry.$field
        if ($null -eq $value -or ($value -is [string] -and [string]::IsNullOrWhiteSpace($value)) -or ($value -is [array] -and $value.Count -eq 0)) { $failures += "$($entry.id): empty $field" }
    }
    foreach ($source in $entry.evidence) {
        if ($source.status -notin @('checked-2026-10-26','inherited-2026-10-22')) { $failures += "$($entry.id): invalid evidence status" }
        if ($source.url -notmatch '^https://') { $failures += "$($entry.id): invalid source URL" }
    }
    foreach ($sub in $entry.subfeatures) {
        if (!$sub.codex -or !$sub.audit) { $failures += "$($entry.id): incomplete subfeature" }
    }
    foreach ($enhancement in $entry.audit_enhancements) {
        if (!$enhancement.change -or !$enhancement.why) { $failures += "$($entry.id): incomplete enhancement" }
    }
    $entry | Add-Member -NotePropertyName family -NotePropertyValue $baseline.family -Force
    $entry | Add-Member -NotePropertyName baseline_source_line -NotePropertyValue $baseline.source_line -Force
    $entry | Add-Member -NotePropertyName kind -NotePropertyValue $(if ($baseline.kind) { $baseline.kind } elseif ([int]$entry.id.Substring(1) -le 75) { 'capability' } else { 'composition-lens' }) -Force
}
if ($entries.Count -ne $expectedEntries.Count) { $failures += "Expected $($expectedEntries.Count) entries, found $($entries.Count)" }
if ($failures.Count) { throw ($failures -join "`n") }
$capabilities = @($entries | Where-Object kind -eq 'capability')
$lenses = @($entries | Where-Object kind -eq 'composition-lens')
$subfeatureCount = @($entries | ForEach-Object { $_.subfeatures }).Count
$capabilitySubfeatureCount = @($capabilities | ForEach-Object { $_.subfeatures }).Count
$enhancementCount = @($entries | ForEach-Object { $_.audit_enhancements }).Count
$checkedSources = @($entries | ForEach-Object { $_.evidence } | Where-Object status -eq 'checked-2026-10-26' | Select-Object -ExpandProperty url -Unique)
$allSources = @($entries | ForEach-Object { $_.evidence } | Select-Object -ExpandProperty url -Unique)
$supplement = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'EXPANDED_BEHAVIORS.md') -Raw
$expandedCount = ([regex]::Matches($supplement, '(?m)^\| E\d{2} /')).Count
function Cell([string]$value) { return $value.Replace('|','\|').Replace("`r",' ').Replace("`n",' ') }
$detail = [System.Collections.Generic.List[string]]::new()
$overview = [System.Collections.Generic.List[string]]::new()
$detail.Add('# Full Codex-to-auditor feature mirror')
$detail.Add('')
$detail.Add('**Date:** October 26, 2026. **Phase:** research and functional mapping. The auditor side describes proposed behavior, not an implemented product. Accepted product phasing is V1 external-record workbench and V2 built-in audit-record mode; detailed architecture and implementation are not selected.')
$detail.Add('')
$detail.Add("Coverage: **$($capabilities.Count) capability groups**, **$($lenses.Count) separately labelled composition lenses**, **$subfeatureCount subfeature mappings** ($capabilitySubfeatureCount within capability groups), **$enhancementCount proposed audit enhancements**, and **$expandedCount expanded behavior entries** linked to the parent groups. The six public component patterns are also mapped separately. Expanded entries unpack grouped capabilities and are not added to the independent feature count.")
$detail.Add('')
$detail.Add('Start with [the comparison overview](CODEX_AUDITOR_FEATURE_MAP.md) for every feature side by side. [Nine worked examples](CODEX_AUDITOR_WORKED_EXAMPLES.md) show how the capabilities combine. Continuous assurance is one example; the inventory covers the full existing catalog, including everyday assistance, execution, artifact work, collaboration, customization, providers, administration and peripherals.')
$detail.Add('')
$detail.Add('## Mapping rule')
$detail.Add('')
$detail.Add('Preserve the role and working experience of each Codex feature, then translate its inputs, actions and results into auditor work. Audit enhancements explain what must change to make that equivalent useful. They belong to this first mirror layer even when technically substantial. A later V2 exercise will consider additional capabilities beyond the mirror; this mapping does not silently defer necessary adaptations.')
$detail.Add('')
$detail.Add('Shared supported saved files are a baseline: the auditor can review work here or continue in Excel, Word, PowerPoint and other tools. An editor API is not required merely to read or write a compatible saved artifact. Live application state, embedded assistance and remote records are separate capabilities. V1 uses external audit records; V2 adds built-in authoritative audit records. An editor choice does not determine record authority.')
$detail.Add('')
$detail.Add('## Evidence and completeness')
$detail.Add('')
$detail.Add('The frozen [source inventory](mapping/2026-10-26/SOURCE_INVENTORY.json) preserves the earlier catalog descriptions, stable C IDs, source lines and file hash. Entries cite inherited October 22 evidence or specifically checked October 26 sources. The official documentation index was revisited to unpack integrations, Security workflows and WebMCP. This is coverage of the named documented inventory and its mapped behaviors, not proof of every undocumented feature, account-specific rollout, or proprietary implementation. No signed-in behavior or audit workflow was executed for this mapping.')
$detail.Add('')
$detail.Add('The user-requested Microsoft Azure Foundry provider is added as C54A beside Bedrock, with [a separately sourced addition](mapping/2026-10-26/PROVIDER_ADDITIONS.json). The original 78-entry inventory and its IDs remain preserved. The Azure entry documents the supported Azure OpenAI route and identifies what still needs validation for the auditor product.')
$detail.Add('')
$detail.Add('Source maturity and service eligibility are preserved as reference conditions. They do not exclude an intended counterpart; they identify what needs evidence before implementation. The public-source mechanism is not assumed to include every desktop or hosted service. [Earlier source/reuse review](RESEARCH_REVIEW.md).')
$detail.Add('')
$detail.Add('Each feature records the developer behavior, proposed auditor use, trigger, inputs, action, outputs, auditor control, smaller behavior mappings, enhancement rationale and remaining boundary. The readable files are generated from [the structured mapping](CODEX_AUDITOR_FEATURE_MIRROR.json); [coverage checks](mapping/2026-10-26/COVERAGE_REPORT.json) reconcile all baseline IDs.')
$detail.Add('')
$overview.Add('# Codex-to-auditor feature map')
$overview.Add('')
$overview.Add('**Date:** October 26, 2026. **Purpose:** map Codex as it is to an auditor experience, including the enhancements needed for that equivalent. This is the first functional mirror layer; V2 additions and architecture planning come afterwards.')
$overview.Add('')
$overview.Add("The map covers **$($capabilities.Count) Codex capability groups and $($lenses.Count) separate composition lenses**, with **$subfeatureCount detailed subfeature mappings**, **$enhancementCount proposed enhancements**, and **$expandedCount expanded behavior entries**. All baseline entries have a counterpart; none was removed because it seemed developer-specific or peripheral.")
$overview.Add('')
$overview.Add('Microsoft Azure Foundry / Azure OpenAI is included as C54A alongside Amazon Bedrock, added at the user''s request and sourced separately from the preserved original inventory.')
$overview.Add('')
$overview.Add('**Subsequent research:** [pass 2](RESEARCH_PASS_02.md) records the accepted team/workspace/writeback defaults, Codex methodology mechanisms and pinned source traces. It also logs newly discovered GCP/Vertex provider support for a follow-up map entry; the counts here remain the reconciled inventory, not a claim that later discoveries are already included.')
$overview.Add('')
$overview.Add('The audit column is our proposed product behavior. The [full mirror](CODEX_AUDITOR_FEATURE_MIRROR.md) contains the current developer behavior, trigger, inputs, actions, outputs, human control, subfeatures, evidence status and limitations for each row. [Nine worked examples](CODEX_AUDITOR_WORKED_EXAMPLES.md) demonstrate orientation, artifact production, change review, investigation, delegation, alternative analyses, advisory work, method reuse and handoff.')
$overview.Add('')
$overview.Add('Preserve the Codex foundation and broad experience. Let auditors review supported artifacts internally or continue in existing tools using the same saved work. V1 uses external record systems; V2 adds built-in audit-record mode. Domain-specific readers, calculations, event adapters and review surfaces needed for the Codex-to-auditor equivalents remain first-layer adaptations; they are not automatically V2 features.')
$overview.Add('')
$lastFamily = ''
foreach ($entry in $entries) {
    if ($entry.family -ne $lastFamily) {
        $lastFamily = $entry.family
        $detail.Add("## $lastFamily")
        $detail.Add('')
        $overview.Add("## $lastFamily")
        $overview.Add('')
        if ($entry.kind -eq 'composition-lens') {
            $detail.Add('These three entries are composition lenses retained from the earlier catalog. They are not additional standalone Codex features.')
            $detail.Add('')
            $overview.Add('These are retained product-composition lenses, not three extra Codex capabilities.')
            $overview.Add('')
        }
        $overview.Add('| ID / Codex capability | Proposed auditor equivalent | Enhancement needed |')
        $overview.Add('| --- | --- | --- |')
    }
    $anchor = $entry.id.ToLowerInvariant()
    $changes = @($entry.audit_enhancements | ForEach-Object { $_.change }) -join ' '
    $overview.Add("| [$($entry.id)](CODEX_AUDITOR_FEATURE_MIRROR.md#$anchor) — $(Cell $entry.feature) | **$(Cell $entry.audit_feature).** $(Cell $entry.audit_action) | $(Cell $changes) |")
    $detail.Add("### $($entry.id)")
    $detail.Add('')
    $detail.Add("**$($entry.feature) → $($entry.audit_feature)**")
    $detail.Add('')
    $detail.Add("**Developer behavior:** $($entry.codex_behavior)")
    $detail.Add('')
    $detail.Add("**Auditor trigger:** $($entry.trigger)")
    $detail.Add('')
    $detail.Add("**Inputs:** $($entry.inputs -join '; ').")
    $detail.Add('')
    $detail.Add("**Proposed auditor action:** $($entry.audit_action)")
    $detail.Add('')
    $detail.Add("**Outputs:** $($entry.outputs -join '; ').")
    $detail.Add('')
    $detail.Add("**Auditor control:** $($entry.auditor_control)")
    $detail.Add('')
    $detail.Add('| Codex subfeature | Auditor mirror |')
    $detail.Add('| --- | --- |')
    foreach ($sub in $entry.subfeatures) { $detail.Add("| $(Cell $sub.codex) | $(Cell $sub.audit) |") }
    $detail.Add('')
    $detail.Add('**Audit-specific enhancements:**')
    $detail.Add('')
    foreach ($change in $entry.audit_enhancements) { $detail.Add("- $($change.change) $($change.why)") }
    $detail.Add('')
    $detail.Add("**Example:** $($entry.example)")
    $detail.Add('')
    $detail.Add("**Boundary / remaining evidence:** $($entry.adaptation_boundary)")
    $detail.Add('')
    $sources = @($entry.evidence | ForEach-Object { "[$($_.label)]($($_.url)) ($($_.status))" }) -join '; '
    $provenance = if ($null -ne $entry.baseline_source_line) { "Baseline: C ID and source line $($entry.baseline_source_line) in the frozen inventory." } else { 'User-requested addition documented separately in PROVIDER_ADDITIONS.json; original baseline IDs are preserved.' }
    $detail.Add("**Codex evidence:** $sources. $provenance")
    $detail.Add('')
}
$detail.Add($supplement)
$overview.Add('')
$overview.Add($supplement)
$overview.Add('')
$overview.Add('## What remains for verification and later planning')
$overview.Add('')
$overview.Add('The functional correspondence is mapped. Remaining work includes source/component reuse, actual client/account availability, file round-trip behavior, live-app integration, event capture, analytical accuracy, role/record semantics and operating costs. These affect how the experience can be delivered. They do not reopen the accepted ambition to mirror the breadth of Codex. Detailed evidence gaps remain in [RESEARCH_REVIEW.md](RESEARCH_REVIEW.md); current choices are in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).')
$detail | Set-Content -LiteralPath (Join-Path $researchRoot 'CODEX_AUDITOR_FEATURE_MIRROR.md') -Encoding utf8
$overview | Set-Content -LiteralPath (Join-Path $researchRoot 'CODEX_AUDITOR_FEATURE_MAP.md') -Encoding utf8
$document = [pscustomobject]@{
    date = '2026-10-26'; status = 'proposed-functional-mapping'; source_inventory_sha256 = $inventory.source_sha256
    audit_side = 'Proposed adaptations; not observed or implemented'; entries = $entries
}
$document | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $researchRoot 'CODEX_AUDITOR_FEATURE_MIRROR.json') -Encoding utf8
$report = [pscustomobject]@{
    date = '2026-10-26'; baseline_entries = 78; additional_entries = $additions.Count; mapped_entries = $entries.Count; missing_ids = @(); duplicate_ids = @(); name_mismatches = @()
    capability_groups = $capabilities.Count; composition_lenses = $lenses.Count; subfeature_mappings = $subfeatureCount
    capability_subfeature_mappings = $capabilitySubfeatureCount; proposed_enhancements = $enhancementCount
    expanded_behavior_entries = $expandedCount; implementation_component_groups = 6
    distinct_row_source_urls = $allSources.Count; rechecked_row_source_urls = $checkedSources.Count
    live_product_workflows_tested = 0; product_code_built = $false
    completeness_boundary = 'Reconciled against frozen documented inventory; expanded behaviors are not extra independent feature groups.'
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'COVERAGE_REPORT.json') -Encoding utf8
$report | ConvertTo-Json -Depth 8 -Compress
