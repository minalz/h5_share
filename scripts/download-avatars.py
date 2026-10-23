"""Compatibility entry point: validate local avatars, without any network access.

Use scripts/build-avatar-library.js with five local source sheets to rebuild China-themed
fictional avatars. This script never restores old online portrait photographs.
"""
from pathlib import Path
import subprocess
import sys

script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent
try:
    result = subprocess.run(['node', str(script_dir / 'build-avatar-library.js'), '--validate'], cwd=project_root)
except FileNotFoundError:
    raise SystemExit('Node.js required for validation; no downloads performed.')
sys.exit(result.returncode)
