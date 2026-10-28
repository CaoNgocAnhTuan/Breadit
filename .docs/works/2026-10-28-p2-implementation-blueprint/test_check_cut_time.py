"""Tests for check_cut_time.py (TC1 to TC11 of plan.md).

Run from the repo root:
    python3 -I .docs/works/2026-10-28-p2-implementation-blueprint/test_check_cut_time.py

With -I the script folder is not on the import path, so the checker is
loaded by its file path. Fixtures are small lists of rows. The two zip files
of TC10 are written to a temporary folder. Standard library only.

Row shapes (the same as the Digg files, after the csv step):
    vote   = (vote_date, voter_id, story_id)
    friend = (mutual, friend_date, user_id, friend_id)
    event  = (event_id, t, user_id, story_id)
"""

import contextlib
import importlib.util
import io
import os
import random
import tempfile
import unittest
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
CHECKER_PATH = os.path.join(HERE, "check_cut_time.py")
DATASETS_MD = os.path.join(HERE, "..", "..", "datasets.md")


def load_checker():
    spec = importlib.util.spec_from_file_location("check_cut_time", CHECKER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cc = load_checker()


def make_events(n, user=1, start=0):
    """n events with t = 10, 20, ... and ids start, start + 1, ..."""
    return [(start + i, 10 * (i + 1), user, 100 + i) for i in range(n)]


# ---------------------------------------------------------------- TC1


class TestTC1AuthorVote(unittest.TestCase):
    ROWS = [
        (110, 11, 1),
        (100, 10, 1),  # the earliest vote of story 1, though not first in the file
        (120, 12, 1),
        (205, 20, 2),
        (200, 21, 2),
    ]

    def test_first_vote_makes_author_and_created_at(self):
        st = cc.stories(cc.dedupe_votes(self.ROWS))
        self.assertEqual(st[1], (10, 100))
        self.assertEqual(st[2], (21, 200))

    def test_first_vote_is_not_a_positive(self):
        rows = cc.dedupe_votes(self.ROWS)
        pos = cc.positives(rows, cc.stories(rows))
        self.assertEqual([(e[1], e[2], e[3]) for e in pos],
                         [(110, 11, 1), (120, 12, 1), (205, 20, 2)])


# ---------------------------------------------------------------- TC2


class TestTC2Dedupe(unittest.TestCase):
    def test_repeated_pair_kept_once_earliest(self):
        rows = [(300, 5, 1), (150, 5, 1), (200, 5, 1), (160, 6, 1)]
        self.assertEqual(cc.dedupe_votes(rows), [(150, 5, 1), (160, 6, 1)])

    def test_same_voter_other_story_is_not_a_repeat(self):
        rows = [(100, 5, 1), (100, 5, 2)]
        self.assertEqual(len(cc.dedupe_votes(rows)), 2)


# ---------------------------------------------------------------- TC3


class TestTC3CutTime(unittest.TestCase):
    def test_event_ids_follow_t_voter_story_order(self):
        # story 1 and 2 are authored by voters 1 and 2 (their first votes)
        rows = [(50, 9, 2), (50, 3, 2), (50, 3, 1), (40, 8, 1), (1, 1, 1), (2, 2, 2)]
        rows = cc.dedupe_votes(rows)
        pos = cc.positives(rows, cc.stories(rows))
        self.assertEqual([e[0] for e in pos], [0, 1, 2, 3])
        self.assertEqual([(e[1], e[2], e[3]) for e in pos],
                         [(40, 8, 1), (50, 3, 1), (50, 3, 2), (50, 9, 2)])

    def test_t_is_the_time_at_rank_ceil_q_n(self):
        pos = make_events(10)  # t = 10 .. 100
        self.assertEqual(cc.cut_time(pos, 0.8), 80)   # rank 8
        self.assertEqual(cc.cut_time(pos, 0.7), 70)   # 0.7 * 10 is 7.000000000000001 in floats
        self.assertEqual(cc.cut_time(pos, 0.9), 90)

    def test_rank_rounds_up(self):
        pos = make_events(9)  # 0.8 * 9 = 7.2 -> rank 8
        self.assertEqual(cc.cut_time(pos, 0.8), 80)

    def test_no_events_is_an_error(self):
        with self.assertRaises(ValueError):
            cc.cut_time([], 0.8)


# ---------------------------------------------------------------- TC4


class TestTC4TestItems(unittest.TestCase):
    def test_event_at_t_is_validation_and_last_after_t_is_test(self):
        pos = [(0, 10, 1, 1), (1, 20, 1, 2), (2, 30, 1, 3), (3, 40, 1, 4),
               (4, 20, 2, 5), (5, 25, 3, 6)]
        pos.sort(key=lambda e: (e[1], e[0]))
        items = cc.test_items(pos, 20)
        self.assertEqual(items[1], (3, 40, 1, 4))   # last after T; the one at T=20 is validation
        self.assertNotIn(2, items)                  # user 2 has only an event at exactly T
        self.assertEqual(items[3], (5, 25, 3, 6))

    def test_user_with_nothing_after_t_has_no_test_item(self):
        pos = [(0, 5, 1, 1), (1, 10, 1, 2)]
        self.assertEqual(cc.test_items(pos, 10), {})

    def test_last_after_t_breaks_time_ties_by_event_id(self):
        pos = [(0, 30, 1, 1), (1, 30, 1, 2)]
        self.assertEqual(cc.test_items(pos, 10)[1], (1, 30, 1, 2))


# ---------------------------------------------------------------- TC5


class TestTC5History(unittest.TestCase):
    def test_counts_strictly_before_and_equal_time_with_smaller_id(self):
        test_ev = (5, 100, 1, 9)
        events = [
            (0, 50, 1, 1),    # before
            (1, 99, 1, 2),    # before
            (3, 100, 1, 3),   # same time, smaller id: counts
            (4, 100, 1, 4),   # same time, smaller id: counts
            (6, 100, 1, 5),   # same time, larger id: does not count
            (7, 101, 1, 6),   # after
            test_ev,          # the test event itself: does not count
        ]
        self.assertEqual(cc.history_count(events, test_ev), 4)

    def test_no_events_is_zero(self):
        self.assertEqual(cc.history_count([], (0, 10, 1, 1)), 0)


# ---------------------------------------------------------------- TC6


class TestTC6Bucket(unittest.TestCase):
    def test_edges(self):
        self.assertEqual(cc.bucket(0), "0")
        self.assertEqual(cc.bucket(1), "1-4")
        self.assertEqual(cc.bucket(4), "1-4")
        self.assertEqual(cc.bucket(5), "5-19")
        self.assertEqual(cc.bucket(19), "5-19")
        self.assertEqual(cc.bucket(20), "20+")
        self.assertEqual(cc.bucket(500), "20+")

    def test_bucket_0_4_is_the_union_of_0_and_1_4(self):
        self.assertEqual(set(cc.BUCKETS_0_4), {"0", "1-4"})
        for n in range(0, 40):
            self.assertEqual(cc.bucket(n) in cc.BUCKETS_0_4, n <= 4)


# ---------------------------------------------------------------- TC7


def make_index(created):
    """created = {story: created_at}. Authors are not needed by the pool."""
    return cc.story_index({s: (0, t) for s, t in created.items()})


class TestTC7Pool(unittest.TestCase):
    W = 100
    T_U = 1000

    def pool(self, test_story, created, own=(), earlier=(), n_max=10):
        return cc.in_pool(self.T_U, test_story, make_index(created), set(own), set(earlier),
                          self.W, n_max)

    def test_window_edges(self):
        created = {1: 900, 2: 899, 3: 1000, 4: 999}
        self.assertTrue(self.pool(1, created))    # exactly W before t_u: in
        self.assertFalse(self.pool(2, created))   # one second earlier: out
        self.assertFalse(self.pool(3, created))   # created at t_u: out
        self.assertTrue(self.pool(4, created))    # one second before t_u: in

    def test_own_story_and_earlier_positives_are_out(self):
        created = {1: 950, 2: 960, 3: 970}
        self.assertFalse(self.pool(1, created, own={1}))
        self.assertFalse(self.pool(2, created, earlier={2}))
        self.assertTrue(self.pool(3, created, own={1}, earlier={2}))

    def test_only_the_newest_n_max_are_in(self):
        created = {1: 910, 2: 920, 3: 930}
        self.assertFalse(self.pool(1, created, n_max=2))  # two newer ones
        self.assertTrue(self.pool(2, created, n_max=2))
        self.assertTrue(self.pool(3, created, n_max=2))

    def test_excluded_stories_do_not_use_up_the_cap(self):
        created = {1: 910, 2: 920, 3: 930}
        self.assertTrue(self.pool(1, created, own={3}, n_max=2))

    def test_created_at_ties_go_to_the_larger_story_id(self):
        created = {4: 940, 5: 940}
        self.assertTrue(self.pool(5, created, n_max=1))
        self.assertFalse(self.pool(4, created, n_max=1))

    def test_pool_size(self):
        created = {1: 910, 2: 920, 3: 930, 4: 899, 5: 1000}
        idx = make_index(created)
        self.assertEqual(cc.pool_size(self.T_U, idx, set(), set(), self.W, 10), 3)
        self.assertEqual(cc.pool_size(self.T_U, idx, {1}, {2}, self.W, 10), 1)
        self.assertEqual(cc.pool_size(self.T_U, idx, set(), set(), self.W, 2), 2)

    def test_matches_brute_force_on_random_fixtures(self):
        rng = random.Random(7)
        for _ in range(200):
            created = {s: rng.randint(850, 1050) for s in range(1, 25)}
            own = {s for s in created if rng.random() < 0.15}
            earlier = {s for s in created if rng.random() < 0.15}
            n_max = rng.randint(1, 8)
            idx = make_index(created)
            eligible = sorted(
                (s for s in created
                 if self.T_U - self.W <= created[s] < self.T_U and s not in own and s not in earlier),
                key=lambda s: (created[s], s), reverse=True)[:n_max]
            self.assertEqual(cc.pool_size(self.T_U, idx, own, earlier, self.W, n_max), len(eligible))
            for s in created:
                if s in own or s in earlier:
                    continue  # the real test story is never one of these
                self.assertEqual(
                    cc.in_pool(self.T_U, s, idx, own, earlier, self.W, n_max), s in eligible)


# ---------------------------------------------------------------- TC8


class TestTC8Follows(unittest.TestCase):
    ROWS = [
        (1, 500, 6, 1),   # kept, dated 500
        (0, 0, 6, 2),     # date 0: dropped
        (1, 700, 6, 6),   # self-link: dropped
        (0, 900, 7, 1),   # kept, dated 900
        (0, 800, 7, 1),   # same pair again: keep the earliest date
        (0, 0, 8, 1),     # only link of user 8 has date 0: user 8 is not in the map
    ]

    def test_zero_dates_and_self_links_are_dropped(self):
        f = cc.follows(self.ROWS)
        self.assertEqual(f[6], [500])
        self.assertEqual(f[7], [800])
        self.assertNotIn(8, f)

    def test_follow_at_exactly_t_u_does_not_count(self):
        f = cc.follows(self.ROWS)
        self.assertEqual(cc.followees_at(f, 6, 500), 0)   # dated exactly t_u
        self.assertEqual(cc.followees_at(f, 6, 501), 1)   # one second earlier counts
        self.assertEqual(cc.followees_at(f, 99, 10 ** 9), 0)


# ---------------------------------------------------------------- TC9


class TestTC9ChooseQ(unittest.TestCase):
    def test_enough_at_08_keeps_08(self):
        self.assertEqual(cc.choose_q({0.7: 500, 0.8: 100, 0.9: 5}), (0.8, False))

    def test_not_enough_at_08_but_enough_at_07(self):
        self.assertEqual(cc.choose_q({0.7: 100, 0.8: 99, 0.9: 5}), (0.7, False))

    def test_not_enough_at_both_keeps_08_and_is_underpowered(self):
        self.assertEqual(cc.choose_q({0.7: 99, 0.8: 99, 0.9: 500}), (0.8, True))

    def test_threshold_is_100(self):
        self.assertEqual(cc.KEPT_THRESHOLD, 100)


# ---------------------------------------------------------------- TC10


def write_zip(path, name="member.csv", text='"1","2","3"\r'):
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr(name, text)


class TestTC10Sha256(unittest.TestCase):
    def test_constants_match_datasets_md(self):
        with open(DATASETS_MD, encoding="utf-8") as fh:
            text = fh.read()
        self.assertIn(cc.DIGG_VOTES_SHA256, text)
        self.assertIn(cc.DIGG_FRIENDS_SHA256, text)

    def test_wrong_sha256_stops_with_exit_2_before_any_row_is_read(self):
        with tempfile.TemporaryDirectory() as tmp:
            votes = os.path.join(tmp, "digg_votes.zip")
            friends = os.path.join(tmp, "digg_friends.zip")
            write_zip(votes)
            write_zip(friends)
            calls = []
            original = cc.rows_of
            cc.rows_of = lambda *a, **k: calls.append(a) or iter(())
            err = io.StringIO()
            try:
                with contextlib.redirect_stderr(err), self.assertRaises(SystemExit) as ctx:
                    cc.main([votes, friends, "--password", "x",
                             "--window-days", "7", "--max-posts", "2000"])
            finally:
                cc.rows_of = original
            self.assertEqual(ctx.exception.code, 2)
            self.assertEqual(calls, [])
            self.assertIn("SHA-256", err.getvalue())

    def test_missing_file_stops_with_exit_2(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err), self.assertRaises(SystemExit) as ctx:
            cc.main(["/nonexistent/a.zip", "/nonexistent/b.zip", "--password", "x",
                     "--window-days", "7", "--max-posts", "2000"])
        self.assertEqual(ctx.exception.code, 2)


# ---------------------------------------------------------------- TC11

VOTES = [
    (1000, 1, 1), (1010, 2, 2),
    (1020, 3, 1), (1030, 4, 1), (1040, 3, 2), (1050, 4, 2),
    (1060, 5, 1), (1070, 5, 2), (1080, 6, 1), (1090, 6, 2),
    (1090, 6, 2),  # a repeated row
]
FRIENDS = [
    (1, 500, 6, 1),   # user 6 follows user 1 since t = 500
    (0, 0, 6, 2),     # undated: dropped
    (0, 5, 5, 5),     # self-link: dropped
]
W = 100
N_MAX = 10


class TestTC11Report(unittest.TestCase):
    def run_report(self, qs=(0.7, 0.8)):
        return cc.report(VOTES, FRIENDS, qs, W, N_MAX)

    def test_same_input_same_text(self):
        self.assertEqual(self.run_report(), self.run_report())

    def test_keys_are_sorted_and_shares_have_six_decimals(self):
        lines = self.run_report().strip().split("\n")
        body = [ln for ln in lines if not ln.startswith(("chosen_q", "underpowered"))]
        keys = [ln.split(" = ", 1)[0] for ln in body]
        self.assertEqual(keys, sorted(keys))
        shares = dict(ln.split(" = ", 1) for ln in body)
        self.assertEqual(shares["q0.8.bucket_1-4.kept_share"], "1.000000")
        self.assertEqual(shares["q0.8.bucket_0.kept_share"], "n/a")

    def test_it_ends_with_the_chosen_q(self):
        lines = self.run_report().strip().split("\n")
        self.assertEqual(lines[-2], "chosen_q = 0.8")
        self.assertEqual(lines[-1], "underpowered = yes")

    def test_values_of_the_fixture(self):
        rep = dict(ln.split(" = ", 1) for ln in self.run_report().strip().split("\n"))
        self.assertEqual(rep["votes_duplicate_rows"], "1")
        self.assertEqual(rep["stories"], "2")
        self.assertEqual(rep["positives"], "8")
        self.assertEqual(rep["follow_dropped_zero_date"], "1")
        self.assertEqual(rep["follow_dropped_self"], "1")
        self.assertEqual(rep["q0.8.n"], "8")
        self.assertEqual(rep["q0.8.T"], "1080")
        self.assertEqual(rep["q0.8.T_utc"], "1970-01-01T00:18:00Z")
        self.assertEqual(rep["q0.8.test_users"], "1")
        self.assertEqual(rep["q0.8.bucket_1-4.test_users"], "1")
        self.assertEqual(rep["q0.8.bucket_1-4.kept"], "1")
        self.assertEqual(rep["q0.8.bucket_1-4.left_out"], "0")
        self.assertEqual(rep["q0.8.bucket_1-4.kept_with_followee"], "1")
        self.assertEqual(rep["q0.8.bucket_0-4.kept"], "1")
        self.assertEqual(rep["q0.8.bucket_0.test_users"], "0")
        self.assertEqual(rep["q0.8.pool_at_T_window"], "2")
        self.assertEqual(rep["q0.8.pool_median"], "1.000000")
        self.assertEqual(rep["q0.7.T"], "1070")


if __name__ == "__main__":
    unittest.main()
