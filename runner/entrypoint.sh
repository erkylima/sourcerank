#!/bin/bash

# Code Runner Entrypoint Script
# Handles initialization and cleanup

set -e

echo "╔════════════════════════════════════════════════════╗"
echo "║  SourceRank Code Runner - Initializing             ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Check required commands
echo "Checking system dependencies..."

for cmd in node npm python3 java go mono; do
  if command -v $cmd &> /dev/null; then
    version=$($cmd --version 2>&1 | head -1 || echo "installed")
    echo "✓ $cmd: $version"
  else
    echo "✗ $cmd: NOT FOUND"
  fi
done

echo ""

# Create necessary directories
echo "Setting up sandbox directories..."
mkdir -p /sandbox
mkdir -p /tmp/executions
chmod 777 /sandbox
chmod 777 /tmp/executions
echo "✓ Sandbox directories ready"

echo ""

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "╔════════════════════════════════════════════════════╗"
  echo "║  Cleaning up...                                    ║"
  echo "╚════════════════════════════════════════════════════╝"
  
  # Kill any lingering processes
  pkill -f "java " 2>/dev/null || true
  pkill -f "python" 2>/dev/null || true
  pkill -f "go run" 2>/dev/null || true
  pkill -f "mono " 2>/dev/null || true
  pkill -f "node " 2>/dev/null || true
  
  # Clean old execution directories
  find /tmp/executions -type d -mtime +1 -exec rm -rf {} + 2>/dev/null || true
  
  echo "✓ Cleanup complete"
}

# Set trap to clean up on exit
trap cleanup EXIT

echo "Starting Node.js server..."
echo ""

# Start the application
exec "$@"
