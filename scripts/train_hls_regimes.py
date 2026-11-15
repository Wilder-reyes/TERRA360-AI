"""Reproduce the published NASA HLS vegetation-regime model locally.

  python scripts/train_hls_regimes.py --check
  python scripts/train_hls_regimes.py --output /tmp/my-regimes.json

No Earthdata secret, network, paid service or pseudo-crop labels are required:
all HLS source observations and their original scene identifiers are already
committed under backend/app/data/history_seed/.
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.services.hls_regime_model import MODEL_FILE, same_model, train_model


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Rebuild and compare with the published artifact")
    parser.add_argument("--output", type=Path, default=MODEL_FILE)
    args = parser.parse_args()
    fitted = train_model()
    if args.check:
        published = json.loads(MODEL_FILE.read_text(encoding="utf-8"))
        if not same_model(published, fitted):
            print("ERROR: published model cannot be reproduced from committed NASA HLS data.")
            return 1
        print("REPRODUCIBLE:", fitted["version"], json.dumps(fitted["validation"], ensure_ascii=False))
        print("SOURCE BLOBS:", json.dumps(fitted["sources"], ensure_ascii=False))
        return 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(fitted, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("TRAINED:", args.output)
    print("METRICS:", json.dumps(fitted["validation"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
