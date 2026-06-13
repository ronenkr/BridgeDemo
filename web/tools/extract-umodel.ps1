# Repeatable asset extraction pipeline: UE4 .uasset/.umap -> glTF/PNG/WAV + JSON dumps.
#
# Prerequisites (downloaded manually, not auto-fetched):
#   C:\Tools\umodel\umodel_64.exe   - UE Viewer (https://www.gildor.org/en/projects/umodel)
#   C:\Tools\UAssetGUI\UAssetGUI.exe - UAssetGUI v1.1+ (https://github.com/atenfyr/UAssetGUI)
#                                      requires .NET 8 Desktop Runtime
#
# Afterwards run:
#   node web/tools/parse-umap.mjs    # -> web/public/assets/level/placements.json
#   node web/tools/stage-assets.mjs  # -> web/public/assets/{models,textures,audio,level}
#
# Notes:
#   - The bridge geometry lives as StaticMesh packages in Content/mesh (LM__*, hull split
#     by material), Content/screens (SC_*, console screen panels) and Content/lights (UL_*,
#     light fixtures). bridge.umap places all of them at the world origin (origin mode).
#   - Meshes export as glTF already converted to meters/Y-up: (x,z,y)/100 from UE space.

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$content = Join-Path $repo "Content"
$out = Join-Path $repo "extract\umodel"
$jsonOut = Join-Path $repo "extract\json"
$umodel = "C:\Tools\umodel\umodel_64.exe"
$uassetgui = "C:\Tools\UAssetGUI\UAssetGUI.exe"

foreach ($tool in @($umodel, $uassetgui)) {
    if (-not (Test-Path $tool)) { throw "Missing $tool - see header for download instructions." }
}
New-Item -ItemType Directory -Force $out, $jsonOut | Out-Null

# 1. Meshes (glTF), textures (PNG) and sounds (WAV) via umodel.
$base = @("-export", "-gltf", "-png", "-sounds", "-path=$content", "-game=ue4.21", "-out=$out")
$patterns = @(
    "mesh/*.uasset",            # bridge hull split by material (LM__*)
    "screens/*.uasset",         # console screen panel meshes (SC_*) + materials/textures
    "screens/textures/*.uasset",
    "screens/mats/*.uasset",
    "lights/*.uasset",          # light fixture meshes (UL_*)
    "materials/*.uasset",
    "textures/*.uasset",
    "lightmats/*.uasset",
    "dynamic/*.uasset",
    "particles/*.uasset",
    "audio/*.uasset",
    "_temp/*.uasset"
)
foreach ($pat in $patterns) {
    Write-Host "umodel export: $pat"
    & $umodel @base $pat | Select-Object -Last 1
}

# 2. Level actor dumps via UAssetGUI (GUI exe detaches from console -> Start-Process -Wait).
foreach ($map in @("bridge", "light", "collision")) {
    Write-Host "UAssetGUI tojson: $map.umap"
    Start-Process -FilePath $uassetgui -Wait -ArgumentList @(
        "tojson", (Join-Path $content "$map.umap"), (Join-Path $jsonOut "$map.json"), "VER_UE4_21"
    )
}

Write-Host "Done. Now run: node web/tools/parse-umap.mjs && node web/tools/stage-assets.mjs"
