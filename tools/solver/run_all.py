"""
run_all.py — one entry point for every solver suite (steps 4-7).

Runs each suite as its own process (clean isolation, same as running it
standalone), prints a one-line status, and dumps full output on failure.
Exit code is non-zero if any suite fails.

    python tools/solver/run_all.py        (or: npm run test:solver)
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SUITES = [
    ("Kuhn CFR engine", "kuhn_cfr.py"),
    ("HU river", "test_postflop.py"),
    ("Multi-street (turn/river)", "test_streets.py"),
    ("Preflop + leaf_ev", "test_preflop.py"),
]

def summary_line(out):
    m = re.search(r"(\d+)/(\d+) checks passed", out)
    if m:
        return f"{m.group(1)}/{m.group(2)} checks"
    return "PASS" if "PASS" in out else ""

def main():
    fails = 0
    print("solver suites:")
    for name, fn in SUITES:
        r = subprocess.run([sys.executable, os.path.join(HERE, fn)],
                           capture_output=True, text=True)
        ok = r.returncode == 0
        print(f"  {'ok  ' if ok else 'FAIL'} {name:28} {summary_line(r.stdout)}")
        if not ok:
            fails += 1
            sys.stdout.write(r.stdout + r.stderr)
    n = len(SUITES)
    print(f"\n{n - fails}/{n} suites passed")
    return 1 if fails else 0

if __name__ == "__main__":
    raise SystemExit(main())
