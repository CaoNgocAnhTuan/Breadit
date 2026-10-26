#!/usr/bin/env python3
"""Numbers from the Digg 2009 zips (task p1-digg-archive-check).

Run:  python3 -I digg_stats.py <digg_votes.zip> <digg_friends.zip> [--password PW]

Standard library only. The zips are untrusted data:
- nothing is extracted and no file is written,
- each zip must hold exactly one member, read as text through zipfile streaming,
- a member that is too large, has a wrong column count or a non-integer id stops
  the run with a line "ERROR: ..." on stderr and exit code 2.

Columns (from the Digg 2009 page, checked against the real rows by the caller):
  votes   : vote_date, voter_id, story_id            (no header)
  friends : mutual, friend_date, user_id, friend_id  (no header)

Output: lines "key = value". Shares are fractions with 6 decimals. Days are UTC.
Percentiles use the nearest rank: sorted[ceil(p * n / 100) - 1].

Degrees (followees, followers) are counted over all users of the friend table
(user_id and friend_id together; users with no link in that direction count as 0).
Self-links are left out of the degrees. Two variants:
  *_listed  : the distinct pairs as they are in the rows
  *_mutual2 : the listed pairs plus the reverse pair of every row with mutual = 1
"""
import argparse
import csv
import datetime
import io
import sys
import zipfile
from collections import Counter

# page counts 3,018,197 votes and 1,731,658 links; the limit is twice that (design F5)
DEFAULT_MAX_VOTES_ROWS = 6036394
DEFAULT_MAX_FRIENDS_ROWS = 3463316
DEFAULT_MAX_MEMBER_BYTES = 300 * 1000 * 1000
ID_LIMIT = 1 << 32
DAY = 86400
EPOCH = datetime.date(1970, 1, 1)


class Stop(Exception):
    pass


def out(key, value):
    if isinstance(value, float):
        value = "%.6f" % value
    print("%s = %s" % (key, value))


def ratio(a, b):
    return a / b if b else "n/a"


def utc_time(ts):
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def utc_day(day_number):
    return (EPOCH + datetime.timedelta(days=day_number)).isoformat()


def percentile(sorted_values, pct):
    n = len(sorted_values)
    rank = -(-pct * n // 100)  # ceil(pct * n / 100) with integers
    return sorted_values[max(rank, 1) - 1]


def rows_of(zip_path, label, ncols, max_rows, max_bytes, password):
    """Yield (line_number, [int, ...]) for each row of the only member of the zip."""
    try:
        zf = zipfile.ZipFile(zip_path)
    except FileNotFoundError:
        raise Stop("cannot open %s: file not found" % zip_path)
    except (zipfile.BadZipFile, OSError) as e:
        raise Stop("cannot open %s as a zip file: %s" % (zip_path, e))
    with zf:
        members = [i for i in zf.infolist() if not i.is_dir()]
        names = [i.filename for i in members]
        if len(members) != 1:
            raise Stop("%s must hold exactly one member, found %d (member names: %s)"
                       % (zip_path, len(members), names))
        info = members[0]
        name = info.filename
        if name.startswith("/") or ".." in name.replace("\\", "/").split("/"):
            raise Stop("member name %r in %s is not safe" % (name, zip_path))
        if info.file_size > max_bytes:
            raise Stop("member %s is too large: %d bytes, limit %d" % (name, info.file_size, max_bytes))
        encrypted = bool(info.flag_bits & 0x1)
        if encrypted and not password:
            raise Stop("member %s in %s is encrypted: give the password with --password" % (name, zip_path))
        out(label + "_member", "%s (%d bytes, %d compressed)" % (name, info.file_size, info.compress_size))
        try:
            raw = zf.open(info, "r", pwd=password.encode("utf-8") if password else None)
        except RuntimeError as e:
            raise Stop("cannot read member %s: wrong password? (%s)" % (name, e))
        text = io.TextIOWrapper(raw, encoding="utf-8", errors="strict", newline=None)
        count = 0
        try:
            for line_no, row in enumerate(csv.reader(text), start=1):
                if not row:
                    continue
                count += 1
                if count > max_rows:
                    raise Stop("too many rows in member %s: more than %d (limit is twice the page count)"
                               % (name, max_rows))
                if len(row) != ncols:
                    raise Stop("columns differ from the page in member %s, line %d: expected %d, found %d"
                               % (name, line_no, ncols, len(row)))
                vals = []
                for v in row:
                    try:
                        vals.append(int(v))
                    except ValueError:
                        if line_no == 1:
                            raise Stop("first row of member %s is not all integers (a header?): %r. "
                                       "The columns differ from the page; check by hand" % (name, row))
                        raise Stop("value %r is not an integer in member %s, line %d" % (v, name, line_no))
                yield line_no, vals
        except (zipfile.BadZipFile, RuntimeError, zlib_error()) as e:
            raise Stop("cannot read member %s: wrong password or damaged zip (%s)" % (name, e))
        except UnicodeDecodeError as e:
            raise Stop("member %s is not plain text: %s (a wrong password can cause this)" % (name, e))
        except csv.Error as e:
            raise Stop("member %s is not a clean csv file: %s" % (name, e))


def zlib_error():
    import zlib
    return zlib.error


def check_id(v, member, line_no):
    if not 0 <= v < ID_LIMIT:
        raise Stop("id %d out of range in member %s, line %d" % (v, member, line_no))


def degree_stats(prefix, degrees):
    degrees = sorted(degrees)
    n = len(degrees)
    total = sum(degrees)
    ge1 = sum(1 for d in degrees if d > 0)
    out(prefix + ".users_ge1", ge1)
    out(prefix + ".mean_ge1", ratio(total, ge1))
    out(prefix + ".mean_all", ratio(total, n))
    for pct in (50, 90, 99):
        out("%s.p%d" % (prefix, pct), percentile(degrees, pct) if n else "n/a")
    out(prefix + ".max", degrees[-1] if n else "n/a")
    out(prefix + ".share_1", ratio(sum(1 for d in degrees if d == 1), n))
    out(prefix + ".share_0", ratio(sum(1 for d in degrees if d == 0), n))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("votes_zip")
    ap.add_argument("friends_zip")
    ap.add_argument("--password", default=None, help="zip password, if the zips are encrypted")
    ap.add_argument("--max-votes-rows", type=int, default=DEFAULT_MAX_VOTES_ROWS)
    ap.add_argument("--max-friends-rows", type=int, default=DEFAULT_MAX_FRIENDS_ROWS)
    ap.add_argument("--max-member-bytes", type=int, default=DEFAULT_MAX_MEMBER_BYTES)
    args = ap.parse_args()

    # ------------------------------------------------------------ votes
    vote_rows = 0
    voter_count = Counter()
    story_count = Counter()
    vote_pairs = set()
    vote_days = Counter()
    first = {}  # story -> [date, voter, rows at that date]
    vmin = vmax = None
    head = 0
    for line_no, (vdate, voter, story) in rows_of(args.votes_zip, "votes", 3, args.max_votes_rows,
                                                  args.max_member_bytes, args.password):
        check_id(voter, "votes", line_no)
        check_id(story, "votes", line_no)
        if head < 3:
            head += 1
            out("head votes row %d" % head, "%d,%d,%d" % (vdate, voter, story))
        vote_rows += 1
        voter_count[voter] += 1
        story_count[story] += 1
        vote_pairs.add((voter << 32) | story)
        vote_days[vdate // DAY] += 1
        vmin = vdate if vmin is None else min(vmin, vdate)
        vmax = vdate if vmax is None else max(vmax, vdate)
        cur = first.get(story)
        if cur is None:
            first[story] = [vdate, voter, 1]
        elif vdate < cur[0]:
            first[story] = [vdate, voter, 1]
        elif vdate == cur[0]:
            cur[2] += 1  # file order keeps the earlier row as the first voter
    if vote_rows == 0:
        raise Stop("the votes member has no rows")

    # ---------------------------------------------------------- friends
    link_rows = 0
    mutual_rows = 0
    self_links = 0
    pairs = set()
    reverse_of_mutual = set()
    user_ids = set()
    friend_ids = set()
    link_days = Counter()
    fmin = fmax = None
    before = inside = after = 0
    head = 0
    for line_no, (mutual, fdate, uid, fid) in rows_of(args.friends_zip, "friends", 4, args.max_friends_rows,
                                                       args.max_member_bytes, args.password):
        if mutual not in (0, 1):
            raise Stop("mutual must be 0 or 1, found %d in friends, line %d" % (mutual, line_no))
        check_id(uid, "friends", line_no)
        check_id(fid, "friends", line_no)
        if head < 3:
            head += 1
            out("head friends row %d" % head, "%d,%d,%d,%d" % (mutual, fdate, uid, fid))
        link_rows += 1
        mutual_rows += mutual
        pairs.add((uid << 32) | fid)
        if uid == fid:
            self_links += 1
        elif mutual:
            reverse_of_mutual.add((fid << 32) | uid)
        user_ids.add(uid)
        friend_ids.add(fid)
        link_days[fdate // DAY] += 1
        fmin = fdate if fmin is None else min(fmin, fdate)
        fmax = fdate if fmax is None else max(fmax, fdate)
        if fdate < vmin:
            before += 1
        elif fdate > vmax:
            after += 1
        else:
            inside += 1
    if link_rows == 0:
        raise Stop("the friends member has no rows")

    users_union = user_ids | friend_ids

    # group 1: counts
    out("votes_rows", vote_rows)
    out("voters", len(voter_count))
    out("stories", len(story_count))
    out("duplicate_vote_rows", vote_rows - len(vote_pairs))
    out("friends_rows", link_rows)
    out("users_as_user_id", len(user_ids))
    out("users_as_friend_id", len(friend_ids))
    out("users_union", len(users_union))
    out("duplicate_link_rows", link_rows - len(pairs))
    out("self_links", self_links)
    out("mutual_rows", mutual_rows)
    out("mutual_share", mutual_rows / link_rows)

    # group 2: links
    top_day, top_links = link_days.most_common(1)[0]
    out("friend_date_min", fmin)
    out("friend_date_min_utc", utc_time(fmin))
    out("friend_date_max", fmax)
    out("friend_date_max_utc", utc_time(fmax))
    out("friend_distinct_days", len(link_days))
    out("friend_top_day", utc_day(top_day))
    out("friend_top_day_links", top_links)
    out("friend_top_day_share", top_links / link_rows)
    out("friend_before_votes_share", before / link_rows)
    out("friend_inside_votes_share", inside / link_rows)
    out("friend_after_votes_share", after / link_rows)

    # group 3: votes
    out("vote_date_min", vmin)
    out("vote_date_min_utc", utc_time(vmin))
    out("vote_date_max", vmax)
    out("vote_date_max_utc", utc_time(vmax))
    out("vote_distinct_days", len(vote_days))
    for day in sorted(vote_days):
        out("votes_day " + utc_day(day), vote_days[day])
    ties = sum(1 for f in first.values() if f[2] >= 2)
    out("first_vote_ties", ties)
    out("first_vote_tie_share", ties / len(first))

    # group 4: join (first voter = author of the story)
    first_voters = [f[1] for f in first.values()]
    voters = list(voter_count)
    out("first_voter_in_friends_as_user_id_share", sum(1 for v in first_voters if v in user_ids) / len(first_voters))
    out("first_voter_in_friends_as_friend_id_share", sum(1 for v in first_voters if v in friend_ids) / len(first_voters))
    out("first_voter_in_friends_share", sum(1 for v in first_voters if v in users_union) / len(first_voters))
    out("voters_in_friends_as_user_id_share", sum(1 for v in voters if v in user_ids) / len(voters))
    out("voters_in_friends_as_friend_id_share", sum(1 for v in voters if v in friend_ids) / len(voters))
    out("voters_in_friends_share", sum(1 for v in voters if v in users_union) / len(voters))
    out("voters_le4_in_friends_share",
        sum(1 for v in voters if voter_count[v] <= 4 and v in users_union) / len(voters))

    # group 5: targets
    listed = [p for p in pairs if (p >> 32) != (p & 0xFFFFFFFF)]
    mutual2 = set(listed) | reverse_of_mutual
    for name, edges in (("listed", listed), ("mutual2", mutual2)):
        outdeg = Counter(e >> 32 for e in edges)
        indeg = Counter(e & 0xFFFFFFFF for e in edges)
        degree_stats("followees_" + name, [outdeg.get(u, 0) for u in users_union])
        degree_stats("followers_" + name, [indeg.get(u, 0) for u in users_union])

    per_voter = sorted(voter_count.values())
    n = len(per_voter)
    total = sum(per_voter)
    out("voter_votes.mean", total / n)
    for pct in (50, 90, 99):
        out("voter_votes.p%d" % pct, percentile(per_voter, pct))
    out("voter_votes.max", per_voter[-1])
    out("voter_votes.share_1", sum(1 for c in per_voter if c == 1) / n)
    top_k = -(-20 * n // 100)
    out("voter_votes.top20_share", sum(per_voter[-top_k:]) / total)
    b1 = sum(1 for c in per_voter if c == 1)
    b24 = sum(1 for c in per_voter if 2 <= c <= 4)
    b519 = sum(1 for c in per_voter if 5 <= c <= 19)
    b20 = sum(1 for c in per_voter if c >= 20)
    out("voter_votes.bucket_1", b1 / n)
    out("voter_votes.bucket_2_4", b24 / n)
    out("voter_votes.bucket_5_19", b519 / n)
    out("voter_votes.bucket_20_plus", b20 / n)
    out("voter_votes.share_le4", (b1 + b24) / n)

    per_story = sorted(story_count.values())
    out("story_votes.mean", sum(per_story) / len(per_story))
    for pct in (50, 90, 99):
        out("story_votes.p%d" % pct, percentile(per_story, pct))
    out("story_votes.max", per_story[-1])


if __name__ == "__main__":
    try:
        main()
    except Stop as e:
        sys.stderr.write("ERROR: %s\n" % e)
        sys.exit(2)
