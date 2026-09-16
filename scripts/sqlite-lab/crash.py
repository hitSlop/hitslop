"""Kill a writer mid-transaction; verify SQLite restores the entire confirmed state."""
import json
import pathlib
import sqlite3
import subprocess
import sys
import tempfile

with tempfile.TemporaryDirectory(prefix="hitslop-sqlite-crash-") as directory:
    target = pathlib.Path(directory) / "crash.slopsql"
    with sqlite3.connect(f"file:{pathlib.Path(sys.argv[1]).resolve()}?mode=ro", uri=True) as source:
        with sqlite3.connect(target) as copy:
            source.backup(copy)
            before = copy.execute("SELECT * FROM document").fetchall()
            outbox = copy.execute("SELECT * FROM outbox").fetchall()
    writer = subprocess.Popen([sys.executable, "-u", "-c", """
import sqlite3, sys, time
db = sqlite3.connect(sys.argv[1])
db.execute('PRAGMA synchronous=FULL')
db.execute('PRAGMA cache_size=1')
db.execute('BEGIN IMMEDIATE')
db.execute('UPDATE document SET generation=generation+1, checkpoint=zeroblob(4194304)')
db.execute('DELETE FROM outbox')
print('staged', flush=True)
time.sleep(30)
""", str(target)], stdout=subprocess.PIPE, text=True)
    try:
        assert writer.stdout.readline().strip() == "staged"
        assert pathlib.Path(str(target) + "-journal").exists()
    finally:
        writer.kill()
        writer.wait()
    with sqlite3.connect(target) as recovered:
        assert recovered.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert recovered.execute("SELECT * FROM document").fetchall() == before
        assert recovered.execute("SELECT * FROM outbox").fetchall() == outbox
    print(json.dumps({"passed": True, "killedWriterRecovery": True, "confirmedStateAndOutboxPreserved": True}))
