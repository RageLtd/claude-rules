# Syncs plugin rules into the project's .claude/rules/ directory.
# Runs on SessionStart (Windows fallback). Idempotent — recreates links each session.
# Tries symlinks first, falls back to copying if symlinks aren't available.
# Project-specific rules (not shipped by this plugin) are never touched.

$ErrorActionPreference = "Stop"

$PluginRoot = $env:CLAUDE_PLUGIN_ROOT
if (-not $PluginRoot) {
    Write-Error "[claude-rules] CLAUDE_PLUGIN_ROOT not set"
    exit 1
}

$PluginRules = Join-Path $PluginRoot "rules"
$TargetRules = Join-Path (Get-Location) ".claude" "rules"

if (-not (Test-Path $PluginRules)) {
    Write-Error "[claude-rules] no rules directory found in plugin"
    exit 1
}

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

    # Remove existing file/link at destination
    if (Test-Path $dest) {
        Remove-Item $dest -Force
    }

    if ($CanSymlink) {
        New-Item -ItemType SymbolicLink -Path $dest -Target $_.FullName | Out-Null
    } else {
        Copy-Item $_.FullName -Destination $dest -Force
    }
}
