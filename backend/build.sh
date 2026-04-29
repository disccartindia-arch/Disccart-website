#!/usr/bin/env bash
# Build script for Render deployment
# This ensures emergentintegrations installs from the private index

set -e

echo "==> Upgrading pip..."
pip install --upgrade pip

echo "==> Installing dependencies with custom index..."
pip install --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ -r requirements.txt

echo "==> Build complete!"
