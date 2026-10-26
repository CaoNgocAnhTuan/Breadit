#!/usr/bin/env python3
"""TC2: check digg_stats.py on tiny hand-made zips (no network, no real data).

Run:  python3 -I .docs/works/2026-10-27-p1-digg-archive-check/check_digg_stats.py

It builds two fixtures in a temporary folder, runs digg_stats.py on them, and
compares every printed number with the values written below by hand.

Fixture A (the main one) has: a tie at a first vote, a duplicate vote, links on
four UTC days, a mutual link, a duplicate link, a self-link, voters that are not
in the friend table, "\r" line ends in the votes file and quoted values.
Fixture B has all links on one UTC day (the crawl-day case).

T0 = 1246320000 is 2009-06-30 00:00:00 UTC. DAY = 86400.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "digg_stats.py")
T0 = 1246320000
DAY = 86400


def quote_rows(rows, eol):
    return "".join(",".join('"%s"' % v for v in r) + eol for r in rows).encode("ascii")


def make_zip(path, member, data):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(member, data)


# ---------------------------------------------------------------- fixture A
VOTES_A = [  # vote_date, voter_id, story_id
    (T0 + 100, 1, 10),
    (T0 + 50, 2, 10),
    (T0 + DAY + 10, 3, 10),
    (T0 + 200, 4, 20),
    (T0 + 200, 5, 20),  # tie with the row above at the first vote of story 20
    (T0 + 300, 1, 20),
    (T0 + 2 * DAY, 6, 30),
    (T0 + 2 * DAY + 5, 2, 30),
    (T0 + 2 * DAY + 9, 2, 30),  # duplicate (voter, story) pair
]
FRIENDS_A = [  # mutual, friend_date, user_id, friend_id
    (1, T0 - DAY, 1, 2),
    (0, T0 + 500, 1, 3),
    (0, T0 + 600, 2, 3),
    (0, T0 + 3 * DAY, 4, 2),
    (0, T0 + 3 * DAY, 4, 2),  # duplicate pair
    (0, T0 + 3 * DAY + 1, 7, 7),  # self-link
    (0, T0 + DAY, 8, 1),
]

EXPECTED_A = {
    # group 1: counts
    "votes_rows": 9,
    "voters": 6,
    "stories": 3,
    "duplicate_vote_rows": 1,
    "friends_rows": 7,
    "users_as_user_id": 5,
    "users_as_friend_id": 4,
    "users_union": 6,
    "duplicate_link_rows": 1,
    "self_links": 1,
    "mutual_rows": 1,
    "mutual_share": 1 / 7,
    # group 2: links
    "friend_date_min": T0 - DAY,
    "friend_date_min_utc": "2009-06-29T00:00:00Z",
    "friend_date_max": T0 + 3 * DAY + 1,
    "friend_date_max_utc": "2009-07-03T00:00:01Z",
    "friend_distinct_days": 4,
    "friend_top_day": "2009-07-03",
    "friend_top_day_links": 3,
    "friend_top_day_share": 3 / 7,
    "friend_before_votes_share": 1 / 7,
    "friend_inside_votes_share": 3 / 7,
    "friend_after_votes_share": 3 / 7,
    # group 3: votes
    "vote_date_min": T0 + 50,
    "vote_date_min_utc": "2009-06-30T00:00:50Z",
    "vote_date_max": T0 + 2 * DAY + 9,
    "vote_date_max_utc": "2009-07-02T00:00:09Z",
    "vote_distinct_days": 3,
    "votes_day 2009-06-30": 5,
    "votes_day 2009-07-01": 1,
    "votes_day 2009-07-02": 3,
    "first_vote_ties": 1,
    "first_vote_tie_share": 1 / 3,
    # group 4: join
    "first_voter_in_friends_as_user_id_share": 2 / 3,
    "first_voter_in_friends_as_friend_id_share": 1 / 3,
    "first_voter_in_friends_share": 2 / 3,
    "voters_in_friends_as_user_id_share": 0.5,
    "voters_in_friends_as_friend_id_share": 0.5,
    "voters_in_friends_share": 4 / 6,
    "voters_le4_in_friends_share": 4 / 6,
    # group 5: targets, votes per voter / per story
    "voter_votes.mean": 1.5,
    "voter_votes.p50": 1,
    "voter_votes.p90": 3,
    "voter_votes.p99": 3,
    "voter_votes.max": 3,
    "voter_votes.share_1": 4 / 6,
    "voter_votes.top20_share": 5 / 9,
    "voter_votes.bucket_1": 4 / 6,
    "voter_votes.bucket_2_4": 2 / 6,
    "voter_votes.bucket_5_19": 0.0,
    "voter_votes.bucket_20_plus": 0.0,
    "voter_votes.share_le4": 1.0,
    "story_votes.mean": 3.0,
    "story_votes.p50": 3,
    "story_votes.p90": 3,
    "story_votes.p99": 3,
    "story_votes.max": 3,
}


def degree_expect(prefix, users_ge1, mean_ge1, mean_all, p50, p90, p99, mx, s1, s0):
    return {
        prefix + ".users_ge1": users_ge1,
        prefix + ".mean_ge1": mean_ge1,
        prefix + ".mean_all": mean_all,
        prefix + ".p50": p50,
        prefix + ".p90": p90,
        prefix + ".p99": p99,
        prefix + ".max": mx,
        prefix + ".share_1": s1,
        prefix + ".share_0": s0,
    }


# Degrees over the 6 users of the friend table, self-link left out.
# listed = the pairs as they are in the rows. mutual2 = listed plus the reverse of every mutual row.
EXPECTED_A.update(degree_expect("followees_listed", 4, 1.25, 5 / 6, 1, 2, 2, 2, 3 / 6, 2 / 6))
EXPECTED_A.update(degree_expect("followers_listed", 3, 5 / 3, 5 / 6, 0, 2, 2, 2, 1 / 6, 3 / 6))
EXPECTED_A.update(degree_expect("followees_mutual2", 4, 1.5, 1.0, 1, 2, 2, 2, 2 / 6, 2 / 6))
EXPECTED_A.update(degree_expect("followers_mutual2", 3, 2.0, 1.0, 0, 2, 2, 2, 0.0, 3 / 6))

# ---------------------------------------------------------------- fixture B
VOTES_B = [(T0 + 10, 1, 5), (T0 + 20, 2, 5)]
FRIENDS_B = [(0, T0 + 3600, 1, 2), (0, T0 + 7200, 2, 1), (0, T0 + 80000, 3, 1)]
EXPECTED_B = {
    "friend_distinct_days": 1,
    "friend_top_day": "2009-06-30",
    "friend_top_day_links": 3,
    "friend_top_day_share": 1.0,
    "friend_before_votes_share": 0.0,
    "friend_inside_votes_share": 0.0,
    "friend_after_votes_share": 1.0,
    "first_vote_ties": 0,
    "first_vote_tie_share": 0.0,
}

failures = []


def fail(msg):
    failures.append(msg)
    print("FAIL:", msg)


def run(args):
    return subprocess.run(
        [sys.executable, "-I", SCRIPT] + args, capture_output=True, text=True, timeout=120
    )


def parse(out):
    d = {}
    for line in out.splitlines():
        if " = " in line:
            k, v = line.split(" = ", 1)
            d[k.strip()] = v.strip()
    return d


def compare(label, got, expected):
    for k, want in expected.items():
        if k not in got:
            fail("%s: key missing: %s" % (label, k))
            continue
        g = got[k]
        if isinstance(want, float):
            try:
                if abs(float(g) - want) > 1e-6:
                    fail("%s: %s = %s, expected %.6f" % (label, k, g, want))
            except ValueError:
                fail("%s: %s = %r is not a number, expected %.6f" % (label, k, g, want))
        elif isinstance(want, int):
            if g != str(want):
                fail("%s: %s = %s, expected %d" % (label, k, g, want))
        else:
            if g != want:
                fail("%s: %s = %s, expected %s" % (label, k, g, want))


def main():
    tmp = tempfile.mkdtemp(prefix="digg-fixture-")
    try:
        # votes file with "\r" line ends, friends file with "\r\n", both quoted: like the real files
        va = os.path.join(tmp, "a_votes.zip")
        fa = os.path.join(tmp, "a_friends.zip")
        make_zip(va, "digg_votes1.csv", quote_rows(VOTES_A, "\r"))
        make_zip(fa, "digg_friends.csv", quote_rows(FRIENDS_A, "\r\n"))
        vb = os.path.join(tmp, "b_votes.zip")
        fb = os.path.join(tmp, "b_friends.zip")
        make_zip(vb, "digg_votes1.csv", quote_rows(VOTES_B, "\n"))
        make_zip(fb, "digg_friends.csv", quote_rows(FRIENDS_B, "\n"))

        r = run([va, fa])
        if r.returncode != 0:
            fail("fixture A: exit code %s, stderr: %s" % (r.returncode, r.stderr.strip()[:300]))
        else:
            compare("A", parse(r.stdout), EXPECTED_A)
            # first rows of each member must be printed (evidence of the real columns)
            if "head votes row 1" not in r.stdout or "head friends row 1" not in r.stdout:
                fail("A: the first rows of the members are not printed")

        r = run([vb, fb])
        if r.returncode != 0:
            fail("fixture B: exit code %s, stderr: %s" % (r.returncode, r.stderr.strip()[:300]))
        else:
            compare("B", parse(r.stdout), EXPECTED_B)

        # error cases: a clear message on stderr, exit code 2, no traceback
        def expect_error(label, args, words):
            r = run(args)
            if r.returncode != 2:
                fail("%s: exit code %s, expected 2" % (label, r.returncode))
            if not r.stderr.startswith("ERROR:"):
                fail("%s: stderr does not start with ERROR: -> %r" % (label, r.stderr[:120]))
            if "Traceback" in r.stderr:
                fail("%s: traceback in stderr" % label)
            for w in words:
                if w not in r.stderr:
                    fail("%s: stderr lacks %r -> %r" % (label, w, r.stderr[:200]))

        expect_error("member too large (row limit)", [va, fa, "--max-votes-rows", "3"], ["too many rows"])

        v_cols = os.path.join(tmp, "c_votes.zip")
        make_zip(v_cols, "digg_votes1.csv", quote_rows([(T0, 1, 5), (T0 + 1, 2)], "\n"))
        expect_error("missing column", [v_cols, fb], ["columns", "line 2"])

        v_int = os.path.join(tmp, "d_votes.zip")
        make_zip(v_int, "digg_votes1.csv", quote_rows([(T0, 1, 5), (T0 + 1, "x7", 5)], "\n"))
        expect_error("non-integer id", [v_int, fb], ["not an integer", "line 2"])

        v_head = os.path.join(tmp, "e_votes.zip")
        make_zip(v_head, "digg_votes1.csv", quote_rows([("vote_date", "voter_id", "story_id")], "\n"))
        expect_error("header row", [v_head, fb], ["first row"])

        v_two = os.path.join(tmp, "f_votes.zip")
        with zipfile.ZipFile(v_two, "w") as z:
            z.writestr("a.csv", "1,2,3\n")
            z.writestr("../evil.csv", "1,2,3\n")
        expect_error("two members / bad path", [v_two, fb], ["member"])

        expect_error("file missing", [os.path.join(tmp, "nope.zip"), fb], ["cannot open"])

        # encrypted zip: only if the system zip tool exists (the stdlib cannot write encrypted zips)
        zbin = shutil.which("zip")
        if zbin:
            enc_dir = os.path.join(tmp, "enc")
            os.mkdir(enc_dir)
            with open(os.path.join(enc_dir, "digg_votes1.csv"), "wb") as fh:
                fh.write(quote_rows(VOTES_A, "\r"))
            with open(os.path.join(enc_dir, "digg_friends.csv"), "wb") as fh:
                fh.write(quote_rows(FRIENDS_A, "\r\n"))
            ev = os.path.join(tmp, "enc_votes.zip")
            ef = os.path.join(tmp, "enc_friends.zip")
            subprocess.run([zbin, "-q", "-j", "-P", "pw123", ev, os.path.join(enc_dir, "digg_votes1.csv")], check=True)
            subprocess.run([zbin, "-q", "-j", "-P", "pw123", ef, os.path.join(enc_dir, "digg_friends.csv")], check=True)
            expect_error("encrypted, no password", [ev, ef], ["password"])
            r = run([ev, ef, "--password", "pw123"])
            if r.returncode != 0:
                fail("encrypted with password: exit %s, stderr %s" % (r.returncode, r.stderr.strip()[:200]))
            else:
                compare("A-encrypted", parse(r.stdout), EXPECTED_A)
            expect_error("encrypted, wrong password", [ev, ef, "--password", "bad"], ["password"])
        else:
            print("note: system zip tool not found, the encrypted-zip checks were skipped")

        # the script must not write files next to itself or into the fixture folder
        left = sorted(set(os.listdir(tmp)) - {"a_votes.zip", "a_friends.zip", "b_votes.zip", "b_friends.zip",
                                               "c_votes.zip", "d_votes.zip", "e_votes.zip", "f_votes.zip",
                                               "enc", "enc_votes.zip", "enc_friends.zip"})
        if left:
            fail("the script wrote files: %s" % left)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if failures:
        print("TC2 FAIL: %d problem(s)" % len(failures))
        return 1
    print("TC2 PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
