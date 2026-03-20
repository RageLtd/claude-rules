# Syncs plugin rules into the project's .claude/rules/ directory and
# generates AGENTS.md (for Forge compatibility) with merged project docs + rules.
#
# Runs on SessionStart (Windows fallback). Idempotent — recreates links and
# regenerates AGENTS.md each session. Tries symlinks first, falls back to
# copying if symlinks aren't available. Project-specific rules (not shipped by
# this plugin) are never touched.

$ErrorActionPreference = "Stop"

$PluginRoot = $env:CLAUDE_PLUGIN_ROOT
if (-not $PluginRoot) {
    Write-Error "[claude-rules] CLAUDE_PLUGIN_ROOT not set"
    exit 1
}

$PluginRules = Join-Path $PluginRoot "rules"
$TargetRules = Join-Path (Get-Location) ".claude" "rules"
$Marker = "<!-- claude-rules:merged -->"

if (-not (Test-Path $PluginRules)) {
    Write-Error "[claude-rules] no rules directory found in plugin"
    exit 1
}

# ── Symlink/copy rules into .claude/rules/ ─────────────────────────────────

# Check if we can create symlinks (requires Developer Mode or admin on Windows)
function Test-SymlinkSupport {
    $testLink = Join-Path $env:TEMP "claude-rules-symlink-test-$(Get-Random)"
    $testTarget = $PluginRules
    try {
        New-Item -ItemType SymbolicLink -Path $testLink -Target $testTarget -ErrorAction Stop | Out-Null
        Remove-Item $testLink -Force
        return $true
    } catch {
        return $false
    }
}

$CanSymlink = Test-SymlinkSupport

# Remove dangling symlinks that point into this plugin (stale rules)
if (Test-Path $TargetRules) {
    Get-ChildItem -Path $TargetRules -Recurse -Force | Where-Object {
        $_.Attributes -band [System.IO.FileAttributes]::ReparsePoint
    } | ForEach-Object {
        $linkTarget = $_.Target
        if ($linkTarget -and $linkTarget.StartsWith($PluginRules) -and -not (Test-Path $_.FullName)) {
            Remove-Item $_.FullName -Force
        }
    }
}

# Walk plugin rules and link/copy each file, preserving directory structure
Get-ChildItem -Path $PluginRules -Recurse -Filter "*.md" -File | ForEach-Object {
    $rel = $_.FullName.Substring($PluginRules.Length + 1)
    $dest = Join-Path $TargetRules $rel
    $destDir = Split-Path $dest -Parent

    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    if (Test-Path $dest) {
        Remove-Item $dest -Force
    }

    if ($CanSymlink) {
        New-Item -ItemType SymbolicLink -Path $dest -Target $_.FullName | Out-Null
    } else {
        Copy-Item $_.FullName -Destination $dest -Force
    }
}

# ── Generate AGENTS.md for Forge ───────────────────────────────────────────

function Get-ProjectDocs {
    $source = $null

    if (Test-Path "CLAUDE.md") {
        $source = "CLAUDE.md"
    } elseif (Test-Path "AGENTS.md") {
        $source = "AGENTS.md"
    } else {
        return ""
    }

    $content = Get-Content $source -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return "" }

    # If file contains our marker, take only content above it
    $markerIndex = $content.IndexOf($Marker)
    if ($markerIndex -ge 0) {
        $content = $content.Substring(0, $markerIndex).TrimEnd()
    }

    return $content
}

function Get-CollectedRules {
    $result = [System.Text.StringBuilder]::new()

    Get-ChildItem -Path $PluginRules -Recurse -Filter "*.md" -File | Sort-Object FullName | ForEach-Object {
        $rel = $_.FullName.Substring($PluginRules.Length + 1)
        $category = Split-Path (Split-Path $rel) -Leaf
        $name = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
        $ruleContent = Get-Content $_.FullName -Raw

        [void]$result.AppendLine("## ${category}/${name}")
        [void]$result.AppendLine("")
        [void]$result.Append($ruleContent)
        [void]$result.AppendLine("")
    }

    return $result.ToString()
}

$projectDocs = Get-ProjectDocs
$rules = Get-CollectedRules

# Write AGENTS.md = project docs + marker + rules
$agentsContent = [System.Text.StringBuilder]::new()
if ($projectDocs) {
    [void]$agentsContent.AppendLine($projectDocs)
    [void]$agentsContent.AppendLine("")
}
[void]$agentsContent.AppendLine($Marker)
[void]$agentsContent.AppendLine("")
[void]$agentsContent.AppendLine("# Rules")
[void]$agentsContent.AppendLine("")
[void]$agentsContent.Append($rules)

Set-Content -Path "AGENTS.md" -Value $agentsContent.ToString() -NoNewline

# If CLAUDE.md is a symlink, replace it with a plain file containing only
# the project docs (Claude Code gets rules via .claude/rules/ symlinks)
$claudeMd = Get-Item "CLAUDE.md" -ErrorAction SilentlyContinue
if ($claudeMd -and ($claudeMd.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    Remove-Item "CLAUDE.md" -Force
    if ($projectDocs) {
        Set-Content -Path "CLAUDE.md" -Value $projectDocs -NoNewline
    }
} elseif (-not (Test-Path "CLAUDE.md") -and $projectDocs) {
    Set-Content -Path "CLAUDE.md" -Value $projectDocs -NoNewline
}
