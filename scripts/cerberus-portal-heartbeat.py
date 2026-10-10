#!/usr/bin/env python3
"""Heartbeat do sensor Cerberus do portal.

Escreve somente um marcador efêmero em /run. Não lê uploads, banco, mailbox
ou segredos e não autoriza o portal por si só.
"""

from __future__ import annotations

import json
import os
import signal
import tempfile
import time
from pathlib import Path

HEARTBEAT = Path(os.environ.get("CERBERUS_SENSOR_HEARTBEAT", "/run/maoadc/cerberus-portal/heartbeat.json"))
INTERVAL = max(2, int(os.environ.get("CERBERUS_HEARTBEAT_INTERVAL", "10")))
running = True


def stop(_signum, _frame):
    global running
    running = False


def write_heartbeat(sequence: int) -> None:
    HEARTBEAT.parent.mkdir(mode=0o750, parents=True, exist_ok=True)
    payload = {
        "service": "cerberus-portal-sensor",
        "state": "ready",
        "pid": os.getpid(),
        "sequence": sequence,
        "timestamp": time.time(),
    }
    fd, temporary = tempfile.mkstemp(prefix="heartbeat.", dir=HEARTBEAT.parent)
    try:
        os.fchmod(fd, 0o640)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(payload, stream, separators=(",", ":"))
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, HEARTBEAT)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
sequence = 0
while running:
    write_heartbeat(sequence)
    sequence += 1
    time.sleep(INTERVAL)
