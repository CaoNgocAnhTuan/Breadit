"""Recall@10 and NDCG@10 by history group, with the supervisor's group bounds (Thesis_Orientation.md, step 5).

Exploratory and descriptive: computed after the test run, not part of the frozen protocol, no p-value.
Input: eval/results/p7-main/per_user.csv (git-ignored; its SHA-256 is in .docs/results/p7-main/manifest.json).
Rebuild it with `npm run harness -w @breadit/eval -- p7-main` if it is missing.
Run from the repo root: python3 .docs/works/2026-11-25-p9-negative-result-note/recall-by-group.py
"""
import csv
import hashlib
import json
import sys

import numpy as np

PER_USER = 'eval/results/p7-main/per_user.csv'
MANIFEST = '.docs/results/p7-main/manifest.json'
K = 10
RESAMPLES = 10_000
SEED = 20261125
GROUPS = [  # (label, test on n_history)
    ('<=5 (supervisor)', lambda h: h <= 5),
    ('>20 (supervisor)', lambda h: h > 20),
    ('0-4 (thesis, check)', lambda h: h <= 4),
    ('20+ (thesis, check)', lambda h: h >= 20),
]


def main() -> None:
    digest = hashlib.sha256(open(PER_USER, 'rb').read()).hexdigest()
    if digest not in json.dumps(json.load(open(MANIFEST))):
        sys.exit(f'{PER_USER} does not match {MANIFEST}')
    print(f'input {PER_USER} sha256 {digest[:16]}… (listed in the manifest)')

    # rank of the test post per (dataset, method, user); per_user.csv holds only the users kept in the analysis.
    rows: dict = {}
    for r in csv.DictReader(open(PER_USER)):
        if r['method'] in ('H', 'BL2'):
            rows.setdefault((r['dataset'], r['user_id']), {})[r['method']] = (int(r['n_history']), int(r['rank']))

    rng = np.random.default_rng(SEED)
    for dataset in ('syn-W2M-M', 'digg2009'):
        print(f'\n{dataset}  (K = {K}; mean over users; diff = H - BL2; 95% paired bootstrap interval, {RESAMPLES} resamples)')
        print(f'{"group":22} {"users":>7}  {"Recall H":>9} {"BL2":>7} {"diff":>7} {"interval":>17}  {"NDCG H":>7} {"BL2":>7} {"diff":>7} {"interval":>17}')
        users = [v for (ds, _), v in rows.items() if ds == dataset]
        for label, test in GROUPS:
            sel = [v for v in users if test(v['H'][0])]
            rank_h = np.array([v['H'][1] for v in sel])
            rank_b = np.array([v['BL2'][1] for v in sel])
            out = [f'{label:22} {len(sel):7d} ']
            for metric in ('recall', 'ndcg'):
                def score(rank: np.ndarray) -> np.ndarray:
                    hit = rank <= K
                    return hit.astype(float) if metric == 'recall' else np.where(hit, 1 / np.log2(rank + 1), 0.0)
                h, b = score(rank_h), score(rank_b)
                d = h - b
                idx = rng.integers(0, len(d), size=(RESAMPLES, len(d)))
                boot = d[idx].mean(axis=1)
                lo, hi = np.percentile(boot, [2.5, 97.5])
                out.append(f'{h.mean():9.4f} {b.mean():7.4f} {d.mean():7.4f} {lo:8.4f} to {hi:6.4f} ')
            print(' '.join(out))


if __name__ == '__main__':
    main()
