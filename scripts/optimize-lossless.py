"""Shrink encoding only. Never resize, requantize or change image pixels."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
import tempfile

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def jpeg_header(data: bytes):
    if data[:2] != b"\xff\xd8":
        raise ValueError("Invalid JPEG signature")
    segments, offset = [], 2
    while offset < len(data):
        start = offset
        if data[offset] != 0xFF:
            raise ValueError("Invalid JPEG marker")
        while data[offset] == 0xFF:
            offset += 1
        marker = data[offset]
        offset += 1
        if marker in (0xDA, 0xD9):
            return segments, data[start:]
        size = struct.unpack_from(">H", data, offset)[0]
        if size < 2 or offset + size > len(data):
            raise ValueError("Invalid JPEG segment")
        segments.append((marker, data[offset + 2:offset + size], data[start:offset + size]))
        offset += size
    raise ValueError("Missing JPEG scan data")


def preserve_jfif(before: bytes, after: bytes) -> bytes:
    original, _ = jpeg_header(before)
    if any(marker == 0xE0 and content.startswith(b"JFIF\x00") for marker, content, _ in original):
        return after
    # jpegtran adds a default JFIF header to untagged JPEGs. Preserve the source
    # metadata instead; changing coding must not add density/color declarations.
    optimized, scans = jpeg_header(after)
    return b"\xff\xd8" + b"".join(raw for marker, content, raw in optimized if not (marker == 0xE0 and content.startswith(b"JFIF\x00"))) + scans


def verify_pixels(before: Path, after: Path) -> dict:
    with Image.open(before) as original, Image.open(after) as optimized:
        original.load()
        optimized.load()
        if original.size != optimized.size or original.mode != optimized.mode:
            raise ValueError(f"Image dimensions or channels changed: {before.name}")
        pixels = original.tobytes()
        if pixels != optimized.tobytes():
            raise ValueError(f"Image pixels changed: {before.name}")
        # Keep color profiles and metadata; progressive scan flags may change.
        ignored = {"progressive", "progression"}
        metadata = lambda im: {k: v for k, v in im.info.items() if k not in ignored}
        if metadata(original) != metadata(optimized):
            raise ValueError(f"Image metadata changed: {before.name}")
        if original.format == "JPEG" and (original.quantization != optimized.quantization or original.layer != optimized.layer):
            raise ValueError(f"JPEG quantization or subsampling changed: {before.name}")
        return {"width": original.width, "height": original.height, "mode": original.mode, "pixelSha256": digest(pixels)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply only smaller, pixel-identical files")
    parser.add_argument("--jpegtran", default=shutil.which("jpegtran"))
    parser.add_argument("--report", type=Path, help="Optional verification report outside the runtime bundle")
    options = parser.parse_args()
    if not options.jpegtran:
        parser.error("An installed jpegtran executable is required; no software is downloaded")
    manifest = json.loads((ROOT / "assets/avatars/manifest.json").read_text(encoding="utf-8"))
    files = []
    for entry in manifest:
        if not re.fullmatch(r"assets/avatars/(women|men|daily|cartoon)-\d+\.jpg", entry["path"]):
            raise ValueError("Unexpected avatar path")
        path = (ROOT / entry["path"]).resolve()
        if path.parent != (ROOT / "assets/avatars").resolve():
            raise ValueError("Avatar outside its asset directory")
        files.append(path)
    if len(files) != 100 or len(set(files)) != 100:
        raise ValueError("Expected exactly 100 distinct avatars")
    records, replacements = [], []
    with tempfile.TemporaryDirectory(prefix=".lossless-optimize-", dir=ROOT) as folder:
        staging = Path(folder).resolve()
        if staging.parent != ROOT or not staging.name.startswith(".lossless-optimize-"):
            raise ValueError("Unsafe temporary directory")
        for path in files:
            before = path.read_bytes()
            candidate = staging / path.name
            subprocess.run([options.jpegtran, "-copy", "all", "-optimize", "-progressive", str(path), str(candidate)], check=True, capture_output=True)
            candidate.write_bytes(preserve_jfif(before, candidate.read_bytes()))
            pixels = verify_pixels(path, candidate)
            after = candidate.read_bytes()
            smaller = len(after) < len(before)
            records.append({"path": path.relative_to(ROOT).as_posix(), "beforeBytes": len(before), "afterBytes": len(after) if smaller else len(before), "beforeSha256": digest(before), "afterSha256": digest(after) if smaller else digest(before), "pixelIdentical": True, **pixels})
            if smaller:
                replacements.append((path, candidate, digest(before)))
        # Validate the whole library before modifying any served image.
        for path, candidate, expected in replacements:
            if digest(path.read_bytes()) != expected:
                raise ValueError("Source changed during verification")
        if options.apply:
            for path, candidate, expected in replacements:
                original, optimized = path.read_bytes(), candidate.read_bytes()
                try:
                    # Preserve the destination file ACLs and verify the write.
                    path.write_bytes(optimized)
                    if path.read_bytes() != optimized:
                        raise IOError("Optimized image write verification failed")
                except Exception:
                    path.write_bytes(original)
                    raise
    report = {"applied": options.apply, "verifiedImages": len(records), "changedImages": len(replacements), "beforeBytes": sum(r["beforeBytes"] for r in records), "afterBytes": sum(r["afterBytes"] for r in records), "records": records}
    if options.report:
        options.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "records"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
