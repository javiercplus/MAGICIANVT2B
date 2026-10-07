#!/bin/bash

# Exit on any error
set -e

echo "======================================"
echo " Packaging MAGICIANVT2B into .run "
echo "======================================"

echo "1. Installing dependencies..."
if command -v bun &> /dev/null; then
    bun install
else
    npm install
fi

echo "2. Building the Next.js standalone app..."
if command -v bun &> /dev/null; then
    bun run build
else
    npm run build
fi

echo "3. Preparing bundle directory..."
BUNDLE_DIR="magicianvt2b-bundle"
rm -rf "$BUNDLE_DIR"
mkdir "$BUNDLE_DIR"

# Copy the standalone output which includes node_modules and server files
cp -a .next/standalone/* "$BUNDLE_DIR/"

# Create an internal start script for the bundle
cat << 'EOF' > "$BUNDLE_DIR/start.sh"
#!/bin/bash
echo "Starting MAGICIANVT2B server..."
echo "Please open http://localhost:4000 in your browser."
# We use node or bun depending on what's available
if command -v bun &> /dev/null; then
    PORT=4000 bun server.js
else
    PORT=4000 node server.js
fi
EOF
chmod +x "$BUNDLE_DIR/start.sh"

echo "4. Creating the self-extracting .run file..."
RUN_FILE="magicianvt2b.run"

# Create the bash header for the self-extracting script
cat << 'EOF' > "$RUN_FILE"
#!/bin/bash
# Self-extracting MAGICIANVT2B archive

# Create a temporary directory
TMPDIR=$(mktemp -d /tmp/magicianvt2b.XXXXXX)

# Find the line number where the payload starts
ARCHIVE=$(awk '/^__ARCHIVE_BELOW__/ {print NR + 1; exit 0; }' "$0")

echo "Extracting MAGICIANVT2B to temporary folder..."
tail -n+$ARCHIVE "$0" | tar xz -C "$TMPDIR"

echo "Launching application..."
cd "$TMPDIR/magicianvt2b-bundle"

# Execute the start script and wait for it to finish
./start.sh

# Cleanup after the server is stopped (e.g., user presses Ctrl+C)
echo "Cleaning up temporary files..."
rm -rf "$TMPDIR"
exit 0

# The payload starts immediately after this line
__ARCHIVE_BELOW__
EOF

# Compress the bundle into a tar.gz payload
tar czf payload.tar.gz "$BUNDLE_DIR"

# Append the binary payload to the bash script
cat payload.tar.gz >> "$RUN_FILE"

# Make the resulting file executable
chmod +x "$RUN_FILE"

# Clean up the intermediate files
rm -rf "$BUNDLE_DIR" payload.tar.gz

echo "======================================"
echo " Done! Executable created: $RUN_FILE "
echo " You can now double-click it or run: ./${RUN_FILE}"
echo "======================================"
