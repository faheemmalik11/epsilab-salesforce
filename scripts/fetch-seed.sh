#!/usr/bin/env bash
# Copies the seed from the reviewer starter repo and verifies it against manifest.json.
set -euo pipefail
SRC="${1:-../salesforce-work-trial/seed}"
DEST="$(dirname "$0")/../seed"
mkdir -p "$DEST"
cp "$SRC"/leads.csv "$SRC"/users-core.csv "$SRC"/manifest.json "$SRC"/README.md "$DEST"/
cd "$DEST"
python3 -I - <<'PY'
import hashlib, json, sys
manifest = json.load(open("manifest.json"))
for f in manifest["files"]:
    digest = hashlib.sha256(open(f["path"], "rb").read()).hexdigest()
    if digest != f["sha256"]:
        sys.exit(f"sha256 mismatch: {f['path']}")
    print(f"ok {f['path']}")
PY
