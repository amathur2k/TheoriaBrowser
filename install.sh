#!/usr/bin/env bash
set -e

NNUE_FILE="nn-baff1ede1f90.nnue"
NNUE_URL="https://github.com/amathur2k/TheoriaBrowser/releases/download/v0.2/${NNUE_FILE}"
WASM_DIR="public/wasm"

echo "=== TheoriaBrowser installer ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed."
  echo "Download it from https://nodejs.org and re-run this script."
  exit 1
fi

NODE_VERSION=$(node --version)
echo "Node.js: $NODE_VERSION"

# Install npm dependencies
echo ""
echo "Installing dependencies..."
npm install

# Download NNUE file if missing
echo ""
if [ -f "$WASM_DIR/$NNUE_FILE" ]; then
  echo "NNUE model already present: $WASM_DIR/$NNUE_FILE"
else
  echo "Downloading NNUE model (~3.4 MB)..."
  mkdir -p "$WASM_DIR"

  if command -v curl &> /dev/null; then
    curl -L --progress-bar -o "$WASM_DIR/$NNUE_FILE" "$NNUE_URL"
  elif command -v wget &> /dev/null; then
    wget --show-progress -O "$WASM_DIR/$NNUE_FILE" "$NNUE_URL"
  else
    echo "Error: Neither curl nor wget is available. Please install one and retry,"
    echo "or manually download $NNUE_URL to $WASM_DIR/$NNUE_FILE"
    exit 1
  fi

  echo "NNUE model downloaded."
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Run the dev server:"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:5173 in your browser."
