param(
    [Parameter(Mandatory = $true)][string]$QtRoot,
    [ValidateRange(1, 32)][int]$Jobs = 4
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'A Windows build environment is required.' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot 'apps/desktop'
$buildRoot = Join-Path $projectRoot '.work/windows'
foreach ($tool in @('git', 'python', 'cmake', 'cpack', 'makensis')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing build tool: $tool" }
}
if (-not (Test-Path (Join-Path $QtRoot 'lib/cmake/Qt6/Qt6Config.cmake'))) {
    throw 'QtRoot must point to the Qt MSVC x64 kit, with Qt NetworkAuth and ShaderTools.'
}
if (-not (Test-Path (Join-Path $sourceRoot 'CMakeLists.txt'))) {
    throw 'Prepare the sources first: python scripts/prepare-sources.py desktop'
}
# CMake embeds these paths in generated source; backslashes can become escapes.
$QtRoot = (Resolve-Path -LiteralPath $QtRoot).Path.Replace('\', '/')
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}
$env:PATH = (Join-Path $QtRoot 'bin') + ';' + $env:PATH
$env:Qt6_DIR = "$QtRoot/lib/cmake/Qt6"
$env:QT_ROOT_DIR = $QtRoot
Invoke-Checked 'git' @('-C', $sourceRoot, 'status', '--short')
Invoke-Checked 'python' @((Join-Path $PSScriptRoot 'prepare-desktop-sdk.py'))
$pythonExecutable = (Get-Command python).Source.Replace('\', '/')
Invoke-Checked 'cmake' @(
    '-S', $sourceRoot, '-B', $buildRoot,
    '-G', 'Visual Studio 17 2022', '-A', 'x64',
    "-DCMAKE_PREFIX_PATH=$QtRoot", "-DPython3_EXECUTABLE=$pythonExecutable", '-DCMAKE_BUILD_TYPE=RelWithDebInfo',
    '-DENABLE_WINDOWS_TOOLS_CHECK=ON', '-DENABLE_APP_PACKAGING=ON',
    '-DENABLE_APP_LICENSE=ON', '-DENABLE_UPDATE_CHECK=OFF', '-DENABLE_CRASH_HANDLER=OFF',
    '-DENABLE_APP_PDF_VIEWER=OFF', '-DENABLE_RNNOISE=OFF'
)
Invoke-Checked 'cmake' @('--build', $buildRoot, '--config', 'RelWithDebInfo', '--parallel', "$Jobs")
Push-Location $buildRoot
# The upstream install step invokes CPack and copies the installer to OUTPUT/Packages.
try { Invoke-Checked 'cmake' @('--install', $buildRoot, '--config', 'RelWithDebInfo') }
finally { Pop-Location }
$installers = @(Get-ChildItem (Join-Path $buildRoot 'OUTPUT/Packages') -Filter 'ApisnixPhone*.exe' -File)
if ($installers.Count -eq 0) { throw 'No ApisnixPhone installer was produced.' }
$outputRoot = Join-Path $projectRoot 'dist/windows'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$installers | Copy-Item -Destination $outputRoot
Write-Output "Unsigned test installers: $outputRoot. Validate on Windows before distribution."
