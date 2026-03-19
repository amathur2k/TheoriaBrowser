# TheoriaBrowser installer for Windows
# Run from the TheoriaBrowser directory:
#   .\install.ps1

$ErrorActionPreference = "Stop"

$NNUE_FILE = "nn-baff1ede1f90.nnue"
$NNUE_URL  = "https://github.com/amathur2k/TheoriaBrowser/releases/download/v0.2/$NNUE_FILE"
$WASM_DIR  = "public\wasm"

Write-Host "=== TheoriaBrowser installer ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "Node.js: $nodeVersion"
} catch {
    Write-Host "Error: Node.js is not installed." -ForegroundColor Red
    Write-Host "Download it from https://nodejs.org and re-run this script."
    exit 1
}

# Install npm dependencies
Write-Host ""
Write-Host "Installing dependencies..."
npm install

# Download NNUE file if missing
Write-Host ""
$nnuePath = Join-Path $WASM_DIR $NNUE_FILE

if (Test-Path $nnuePath) {
    Write-Host "NNUE model already present: $nnuePath"
} else {
    Write-Host "Downloading NNUE model (~3.4 MB)..."
    New-Item -ItemType Directory -Force -Path $WASM_DIR | Out-Null

    try {
        $progressPreference = 'SilentlyContinue'  # Speeds up Invoke-WebRequest
        Invoke-WebRequest -Uri $NNUE_URL -OutFile $nnuePath
        Write-Host "NNUE model downloaded."
    } catch {
        Write-Host "Error downloading NNUE file: $_" -ForegroundColor Red
        Write-Host "Please manually download from:"
        Write-Host "  $NNUE_URL"
        Write-Host "and place it at: $nnuePath"
        exit 1
    }
}

Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Run the dev server:"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Then open http://localhost:5173 in your browser."
