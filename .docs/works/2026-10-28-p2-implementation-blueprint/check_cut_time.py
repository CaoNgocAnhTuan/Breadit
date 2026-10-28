#!/usr/bin/env python3
"""Digg 2009 check of the cut-time rule T (task p2-implementation-blueprint).

Run:
    python3 -I check_cut_time.py <digg_votes.zip> <digg_friends.zip> --password PW \
        --window-days DAYS --max-posts N [--q 0.7,0.8,0.9]

The window and the pool cap are passed in. Their values are in super-plan section 7,
row "Window W / pool cap N_max". They are not written in this file.

Standard library only. The zips are untrusted data, so nothing is extracted and no file
is written. Before it reads any row, the script checks the SHA-256 of both zips against
the two values in .docs/datasets.md section 4. A mismatch stops the run with exit code 2.
Rows are read with rows_of from digg_stats.py (task p1-digg-archive-check): one member,
streaming, limits on rows, bytes and columns.

Rule (blueprint section 3): sort all positives by (t, event_id), n = how many.
T is the time of the positive at rank ceil(q * n). A test item has t > T.
A user's test item is the user's last positive with t > T.

Choices made only for this check (the P4 task decides them for real):
  - a repeated (voter, story) row keeps its earliest vote
  - the first vote of a story is its author's post; it is not a positive
  - the story's created_at is the time of that vote
  - links with friend_date 0 and self-links are dropped
  - a follow counts at t_u when friend_date < t_u
  - events are numbered by sorting on (t, voter_id, story_id)

Row shapes:
  vote   = (vote_date, voter_id, story_id)
  friend = (mutual, friend_date, user_id, friend_id)
  event  = (event_id, t, user_id, story_id)

Output: lines "key = value", sorted by key, shares with 6 decimals, times in UTC.
It ends with "chosen_q = ..." and, if needed, "underpowered = yes".
"""
import argparse
import contextlib
import datetime
import hashlib
import importlib.util
import io
import os
import statistics
import sys
from bisect import bisect_left, bisect_right
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
DIGG_STATS_PATH = os.path.join(HERE, "..", "2026-10-27-p1-digg-archive-check", "digg_stats.py")


def _load_digg_stats():
    spec = importlib.util.spec_from_file_location("digg_stats", DIGG_STATS_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_digg = _load_digg_stats()
rows_of = _digg.rows_of
Stop = _digg.Stop
check_id = _digg.check_id

# from .docs/datasets.md section 4
DIGG_VOTES_SHA256 = "55bba035e08d31f14022aeef1f57b24322d2c0bea1fb241e3c99b0af59aafda1"
DIGG_FRIENDS_SHA256 = "4d5d3189c66d0606dc09aa919444cfc2377613a8011766af6f0ea9f3359c3bba"

# from the blueprint, section 3 (fixed before the Digg count)
KEPT_THRESHOLD = 100
Q_FIRST = 0.8
Q_FALLBACK = 0.7

BUCKETS = ("0", "1-4", "5-19", "20+")
BUCKETS_0_4 = ("0", "1-4")
REPORT_BUCKETS = ("0", "1-4", "0-4", "5-19", "20+")
DAY = 86400


# ---------------------------------------------------------------- core, plain lists


def dedupe_votes(rows):
    """One row per (voter, story), the earliest. Sorted by (t, voter, story)."""
    best = {}
    for t, voter, story in rows:
        key = (voter << 32) | story
        old = best.get(key)
        if old is None or t < old:
            best[key] = t
    return sorted((t, key >> 32, key & 0xFFFFFFFF) for key, t in best.items())


def stories(rows):
    """{story: (author, created_at)}. The earliest vote (ties: smaller voter id) is the author's."""
    first = {}
    for t, voter, story in rows:
        cur = first.get(story)
        if cur is None or (t, voter) < cur:
            first[story] = (t, voter)
    return {story: (voter, t) for story, (t, voter) in first.items()}


def positives(rows, authors):
    """Events (event_id, t, user, story) for every vote that is not the author's own first vote.

    Ids are the ranks in (t, voter_id, story_id) order, starting at 0.
    """
    kept = sorted((t, voter, story) for t, voter, story in rows if authors[story][0] != voter)
    return [(i, t, voter, story) for i, (t, voter, story) in enumerate(kept)]


def follows(rows):
    """{user: sorted list of follow dates}. Date 0 and self-links are dropped; a pair keeps its earliest date."""
    best = {}
    for _mutual, fdate, user, friend in rows:
        if fdate == 0 or user == friend:
            continue
        key = (user << 32) | friend
        old = best.get(key)
        if old is None or fdate < old:
            best[key] = fdate
    out = {}
    for key, fdate in best.items():
        out.setdefault(key >> 32, []).append(fdate)
    for dates in out.values():
        dates.sort()
    return out


def followees_at(follow_map, user, t_u):
    """Number of followees of the user with a follow date strictly before t_u."""
    return bisect_left(follow_map.get(user, ()), t_u)


def cut_time(pos, q):
    """T = time of the event at rank ceil(q * n). `pos` is sorted by (t, event_id)."""
    n = len(pos)
    if n == 0:
        raise ValueError("no positive events")
    qf = Fraction(str(q))  # exact: 0.7 * 10 must be 7, not 7.000000000000001
    if not 0 < qf <= 1:
        raise ValueError("q must be in (0, 1]")
    rank = -(-qf.numerator * n // qf.denominator)  # ceil with integers
    return pos[rank - 1][1]


def test_items(pos, cut):
    """{user: event}: the user's last positive (by (t, event_id)) with t > T."""
    best = {}
    for ev in pos:
        if ev[1] > cut:
            cur = best.get(ev[2])
            if cur is None or (ev[1], ev[0]) > (cur[1], cur[0]):
                best[ev[2]] = ev
    return best


def earlier_events(events, test_ev):
    """The user's events before the test event: t smaller, or equal t with a smaller event id."""
    key = (test_ev[1], test_ev[0])
    return [e for e in events if (e[1], e[0]) < key]


def history_count(events, test_ev):
    return len(earlier_events(events, test_ev))


def bucket(n):
    if n == 0:
        return "0"
    if n <= 4:
        return "1-4"
    if n <= 19:
        return "5-19"
    return "20+"


class StoryIndex:
    """Stories sorted by (created_at, story_id) for bisect, plus created_at by story."""

    def __init__(self, story_map):
        self.created = {s: created for s, (_author, created) in story_map.items()}
        self.keys = sorted((created, s) for s, created in self.created.items())


def story_index(story_map):
    return StoryIndex(story_map)


_LOW = float("-inf")


def _window_bounds(index, t_u, window):
    lo = bisect_left(index.keys, (t_u - window, _LOW))
    hi = bisect_left(index.keys, (t_u, _LOW))
    return lo, hi


def _in_window(index, story, t_u, window):
    created = index.created.get(story)
    return created is not None and t_u - window <= created < t_u


def pool_size(t_u, index, own, earlier, window, max_posts):
    """Stories in the pool of a user at t_u: in the window, not own, not touched before, newest max_posts."""
    lo, hi = _window_bounds(index, t_u, window)
    excluded = sum(1 for s in (own | earlier) if _in_window(index, s, t_u, window))
    return min(max_posts, hi - lo - excluded)


def in_pool(t_u, test_story, index, own, earlier, window, max_posts):
    """True when the test story is in the pool at t_u."""
    if not _in_window(index, test_story, t_u, window):
        return False
    if test_story in own or test_story in earlier:
        return False
    _lo, hi = _window_bounds(index, t_u, window)
    key = (index.created[test_story], test_story)
    newer = hi - bisect_right(index.keys, key)
    for s in (own | earlier):
        if _in_window(index, s, t_u, window) and (index.created[s], s) > key:
            newer -= 1
    return newer < max_posts


def choose_q(kept_0_4):
    """(q, underpowered) from {q: kept test users in bucket 0-4}. Rule: blueprint section 3."""
    if Q_FIRST not in kept_0_4:
        raise ValueError("q = %s must be in the list" % Q_FIRST)
    if kept_0_4[Q_FIRST] >= KEPT_THRESHOLD:
        return Q_FIRST, False
    if kept_0_4.get(Q_FALLBACK, 0) >= KEPT_THRESHOLD:
        return Q_FALLBACK, False
    return Q_FIRST, True


# ---------------------------------------------------------------- report


def fmt(value):
    if isinstance(value, float):
        return "%.6f" % value
    return str(value)


def share(a, b):
    return a / b if b else "n/a"


def utc_time(ts):
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def prepare(votes, friends):
    deduped = dedupe_votes(votes)
    story_map = stories(deduped)
    pos = positives(deduped, story_map)
    by_user = {}
    for ev in pos:
        by_user.setdefault(ev[2], []).append(ev)
    authored = {}
    for s, (author, _created) in story_map.items():
        authored.setdefault(author, set()).add(s)
    zero = sum(1 for r in friends if r[2] != r[3] and r[1] == 0)
    selfl = sum(1 for r in friends if r[2] == r[3])
    return {
        "votes_rows": len(votes),
        "votes_deduped": len(deduped),
        "stories": story_map,
        "positives": pos,
        "by_user": by_user,
        "authored": authored,
        "index": story_index(story_map),
        "follows": follows(friends),
        "friends_rows": len(friends),
        "dropped_zero": zero,
        "dropped_self": selfl,
    }


def analyze_q(data, q, window, max_posts):
    """({key: value} for one q, kept test users in bucket 0-4)."""
    pos = data["positives"]
    index = data["index"]
    cut = cut_time(pos, q)
    tests = test_items(pos, cut)
    stats = {b: {"test": 0, "kept": 0, "kept_f": 0} for b in REPORT_BUCKETS}
    pool_sizes = []
    for user, test_ev in tests.items():
        earlier_ev = earlier_events(data["by_user"][user], test_ev)
        label = bucket(len(earlier_ev))
        earlier = {e[3] for e in earlier_ev}
        own = data["authored"].get(user, frozenset())
        t_u = test_ev[1]
        kept = in_pool(t_u, test_ev[3], index, own, earlier, window, max_posts)
        groups = [label] + (["0-4"] if label in BUCKETS_0_4 else [])
        has_followee = followees_at(data["follows"], user, t_u) >= 1
        if kept:
            pool_sizes.append(pool_size(t_u, index, own, earlier, window, max_posts))
        for g in groups:
            stats[g]["test"] += 1
            if kept:
                stats[g]["kept"] += 1
                if has_followee:
                    stats[g]["kept_f"] += 1
    prefix = "q%s." % q
    res = {
        prefix + "n": len(pos),
        prefix + "T": cut,
        prefix + "T_utc": utc_time(cut),
        prefix + "test_users": len(tests),
        prefix + "pool_at_T_window": pool_size(cut, index, frozenset(), frozenset(), window, len(index.keys)),
        prefix + "pool_at_T": pool_size(cut, index, frozenset(), frozenset(), window, max_posts),
        prefix + "pool_median": float(statistics.median(pool_sizes)) if pool_sizes else "n/a",
    }
    for b in REPORT_BUCKETS:
        s = stats[b]
        p = prefix + "bucket_" + b + "."
        res[p + "test_users"] = s["test"]
        res[p + "kept"] = s["kept"]
        res[p + "left_out"] = s["test"] - s["kept"]
        res[p + "kept_with_followee"] = s["kept_f"]
        res[p + "kept_share"] = share(s["kept"], s["test"])
        res[p + "kept_with_followee_share"] = share(s["kept_f"], s["kept"])
    return res, stats["0-4"]["kept"]


def report(votes, friends, qs, window, max_posts, extra=None):
    """The whole output text for lists of vote rows and friend rows."""
    data = prepare(votes, friends)
    body = {
        "votes_rows": data["votes_rows"],
        "votes_duplicate_rows": data["votes_rows"] - data["votes_deduped"],
        "stories": len(data["stories"]),
        "positives": len(data["positives"]),
        "friends_rows": data["friends_rows"],
        "follow_dropped_zero_date": data["dropped_zero"],
        "follow_dropped_self": data["dropped_self"],
        "follow_users": len(data["follows"]),
        "window_sec": window,
        "max_posts": max_posts,
    }
    body.update(extra or {})
    kept_0_4 = {}
    for q in qs:
        res, kept = analyze_q(data, q, window, max_posts)
        body.update(res)
        kept_0_4[q] = kept
    lines = ["%s = %s" % (k, fmt(body[k])) for k in sorted(body)]
    if Q_FIRST in kept_0_4:
        chosen, under = choose_q(kept_0_4)
        lines.append("chosen_q = %s" % chosen)
        if under:
            lines.append("underpowered = yes")
    else:
        lines.append("chosen_q = n/a")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- command line


def sha256_of(path):
    h = hashlib.sha256()
    try:
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
    except OSError as e:
        raise Stop("cannot read %s: %s" % (path, e))
    return h.hexdigest()


def check_sha256(path, expected):
    got = sha256_of(path)
    if got != expected:
        raise Stop("SHA-256 of %s is %s, expected %s (the value in .docs/datasets.md section 4)"
                   % (path, got, expected))


def read_rows(path, label, ncols, max_rows, max_bytes, password):
    rows = []
    for line_no, vals in rows_of(path, label, ncols, max_rows, max_bytes, password):
        for v in vals[ncols - 2:] if label == "friends" else vals[1:]:
            check_id(v, label, line_no)
        rows.append(tuple(vals))
    return rows


def parse_q(text):
    try:
        qs = [float(x) for x in text.split(",") if x.strip()]
    except ValueError:
        raise Stop("--q must be a comma list of numbers, got %r" % text)
    if not qs or any(not 0 < q <= 1 for q in qs):
        raise Stop("--q values must be in (0, 1]")
    return qs


def run(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("votes_zip")
    ap.add_argument("friends_zip")
    ap.add_argument("--password", default=None)
    ap.add_argument("--window-days", type=int, required=True, help="W, from super-plan section 7")
    ap.add_argument("--max-posts", type=int, required=True, help="N_max, from super-plan section 7")
    ap.add_argument("--q", default="0.7,0.8,0.9")
    ap.add_argument("--max-votes-rows", type=int, default=_digg.DEFAULT_MAX_VOTES_ROWS)
    ap.add_argument("--max-friends-rows", type=int, default=_digg.DEFAULT_MAX_FRIENDS_ROWS)
    ap.add_argument("--max-member-bytes", type=int, default=_digg.DEFAULT_MAX_MEMBER_BYTES)
    args = ap.parse_args(argv)
    if args.window_days <= 0 or args.max_posts <= 0:
        raise Stop("--window-days and --max-posts must be positive")
    qs = parse_q(args.q)

    check_sha256(args.votes_zip, DIGG_VOTES_SHA256)
    check_sha256(args.friends_zip, DIGG_FRIENDS_SHA256)

    notes = io.StringIO()  # rows_of prints one "<label>_member = ..." line
    with contextlib.redirect_stdout(notes):
        votes = read_rows(args.votes_zip, "votes", 3, args.max_votes_rows, args.max_member_bytes, args.password)
        friends = read_rows(args.friends_zip, "friends", 4, args.max_friends_rows, args.max_member_bytes,
                            args.password)
    if not votes or not friends:
        raise Stop("a member has no rows")
    extra = {}
    for line in notes.getvalue().splitlines():
        key, _sep, value = line.partition(" = ")
        extra[key] = value
    sys.stdout.write(report(votes, friends, qs, args.window_days * DAY, args.max_posts, extra))


def main(argv=None):
    try:
        run(sys.argv[1:] if argv is None else argv)
    except Stop as e:
        sys.stderr.write("ERROR: %s\n" % e)
        sys.exit(2)


if __name__ == "__main__":
    main()
