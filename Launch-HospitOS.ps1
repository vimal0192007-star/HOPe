# Alias launcher calling Start-HOPe.ps1
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
}
if (-not $ScriptDir) {
    $ScriptDir = "D:\HOPe"
}

$StartScript = Join-Path $ScriptDir "Start-HOPe.ps1"
& $StartScript
