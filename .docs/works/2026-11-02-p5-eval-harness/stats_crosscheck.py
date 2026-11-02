"""Cross-check of eval/src/stats.ts against scipy (task p5-eval-harness, Step 3, design "The scipy cross-check").

Run once, in a virtual environment outside the repo with pinned numpy and scipy:

    python -I stats_crosscheck.py ../../../eval/src/stats-fixture.csv stats_reference.json

It reads the 14 paired values of the fixture (columns user_id, method, ref) and writes:
  - exact_p: the exact two-sided p of scipy.stats.permutation_test (permutation_type="samples", all 2^14
    sign patterns) for the mean of (method - ref);
  - ci_low, ci_high: the 95% CI of scipy.stats.bootstrap (paired=True, method="percentile");
  - the Python, numpy and scipy versions.
The TypeScript test (eval/src/stats.test.ts) compares our numbers with this file.
"""
import csv
import json
import platform
import sys

import numpy as np
import scipy
from scipy.stats import bootstrap, permutation_test

SEED = 20261014  # the master seed of super-plan section 7; any fixed seed would do
RESAMPLES = 10000  # the bootstrap resample count of super-plan section 7
LEVEL = 0.95  # the confidence level of super-plan section 7


def mean_diff(x, y, axis):
    return np.mean(x - y, axis=axis)


def main(fixture_path, out_path):
    with open(fixture_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    method = np.array([float(r["method"]) for r in rows])
    ref = np.array([float(r["ref"]) for r in rows])
    n = len(rows)

    exact = permutation_test(
        (method, ref),
        mean_diff,
        permutation_type="samples",
        n_resamples=np.inf,
        alternative="two-sided",
        vectorized=True,
    )
    boot = bootstrap(
        (method, ref),
        mean_diff,
        paired=True,
        vectorized=True,
        n_resamples=RESAMPLES,
        confidence_level=LEVEL,
        method="percentile",
        random_state=np.random.default_rng(SEED),
    )
    out = {
        "fixture": fixture_path.replace("\\", "/").split("/")[-1],
        "n": n,
        "mean_diff": float(np.mean(method - ref)),
        "exact_p": float(exact.pvalue),
        "n_permutations": int(len(exact.null_distribution)),
        "ci_low": float(boot.confidence_interval.low),
        "ci_high": float(boot.confidence_interval.high),
        "bootstrap": {"resamples": RESAMPLES, "level": LEVEL, "method": "percentile", "paired": True, "seed": SEED},
        "versions": {"python": platform.python_version(), "numpy": np.__version__, "scipy": scipy.__version__},
    }
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, indent=2, sort_keys=True)
        f.write("\n")
    print(json.dumps(out, indent=2, sort_keys=True))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: python -I stats_crosscheck.py <fixture.csv> <out.json>")
    main(sys.argv[1], sys.argv[2])
