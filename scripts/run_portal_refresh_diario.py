#!/usr/bin/env python3
"""Ponto diário do cron para a esteira de compra Atlas."""
from __future__ import annotations

import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

PYTHON = Path("/home/administrador/deepseek-env/bin/python3")
PIPELINE = Path("/home/administrador/rms/scripts/run_atlas_compra_pipeline.py")


def log(message: str) -> None:
    print(f"[{datetime.now(timezone.utc).isoformat(timespec='seconds')}] {message}", flush=True)


def main() -> int:
    if not PYTHON.is_file() or not PIPELINE.is_file():
        log("NO-GO: runtime ou esteira Atlas ausente")
        return 2
    environment = os.environ.copy()
    environment.setdefault("LD_LIBRARY_PATH", "/home/administrador/instantclient_19_25")
    log("INICIO esteira=atlas_compra fluxos=estoque,vendas modo=sequencial")
    result = subprocess.run([str(PYTHON), str(PIPELINE)], env=environment, check=False)
    if result.returncode:
        log(f"NO-GO esteira=atlas_compra status={result.returncode}")
        return result.returncode
    log("GO esteira=atlas_compra fluxos=estoque,vendas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
