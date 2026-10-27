"""Checker for the related-work survey (task p1-related-work).

Usage:
    python3 -I check_survey.py <survey.md> <super-plan.md> <literature.md>

It reads three files, writes nothing, and prints PASS or FAIL for DW1, DW2,
DW3 (machine half), DW4, DW6, DW7 and Refs, then some lists for the reviewer.
Exit code 0 if every check passes, 1 if not. Standard library only.
"""

import re
import sys

WORDS_MIN = 1500
WORDS_MAX = 2200
SENTENCE_MAX = 35
BANNED = ("no one", "nobody", "first", "never", "novel", "unique")
CHECKS = ("DW1", "DW2", "DW3", "DW4", "DW6", "DW7", "Refs")

CITATION = re.compile(r"\[(\d+(?:\s*,\s*\d+)*)\]")
NUMBER = re.compile(
    r"(?<![A-Za-z0-9])(?:\d{4}-\d{2}-\d{2}|\d+(?:,\d{3})*(?:\.\d+)?%?)"
)
YEAR = re.compile(r"(?:19|20)\d\d")
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
ABBREVIATIONS = ("e.g.", "i.e.", "et al.", "vs.", "etc.", "cf.", "Fig.", "Eq.")


# ---------------------------------------------------------------- parsing


def cited_numbers(text):
    """Every n in [n] or [n, m] of the text, sorted, without repeats."""
    found = set()
    for match in CITATION.finditer(text):
        for part in match.group(1).split(","):
            found.add(int(part))
    return sorted(found)


def section(text, start_prefix, stop):
    """Lines after the first line that starts with start_prefix, up to a stop.

    `stop` is a function of a line. Returns None if the start is not found.
    """
    lines = text.split("\n")
    for index, line in enumerate(lines):
        if line.startswith(start_prefix):
            out = []
            for later in lines[index + 1:]:
                if stop(later):
                    break
                out.append(later)
            return out
    return None


def parse_superplan(text):
    """{n: (line text before ' · ', status word)} from section 10."""
    lines = section(
        text, "## 10.", lambda line: line.startswith("## ") or line.strip() == "---"
    )
    refs = {}
    for line in lines or []:
        match = re.match(r"^(\d+)\.\s+(.*\S)\s*$", line)
        if not match:
            continue
        number, rest = int(match.group(1)), match.group(2)
        if " · " in rest:
            ref_text, _, status_text = rest.partition(" · ")
            words = status_text.split()
            status = words[0].lower() if words else "missing"
        else:
            ref_text, status = rest, "missing"
        refs[number] = (ref_text.strip(), status)
    return refs


def parse_literature(text):
    """{n: read depth} from the status table in section 1."""
    lines = section(text, "## 1.", lambda line: line.startswith("## "))
    depth = {}
    for line in lines or []:
        if not line.startswith("| ["):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        match = re.fullmatch(r"\[(\d+)\]", cells[0])
        if match and len(cells) >= 5:
            depth[int(match.group(1))] = cells[4].lower()
    return depth


def split_survey(text):
    """(body, table_lines, reference_lines). Body starts at the first '## 1.'."""
    lines = text.split("\n")
    start = next((i for i, l in enumerate(lines) if l.startswith("## 1.")), None)
    table = next((i for i, l in enumerate(lines) if l.startswith("## Citation table")), None)
    refs = next((i for i, l in enumerate(lines) if l.startswith("## References")), None)
    body = None
    if start is not None and table is not None and table > start:
        body = "\n".join(lines[start:table])
    table_lines = None
    if table is not None:
        end = refs if refs is not None and refs > table else len(lines)
        table_lines = lines[table + 1:end]
    ref_lines = None
    if refs is not None:
        ref_lines = lines[refs + 1:]
    return body, table_lines, ref_lines


def split_sentences(text):
    """Sentences of the prose in text. Headings and table rows are skipped."""
    blocks = []
    current = []

    def flush():
        if current:
            blocks.append(" ".join(current))
            current.clear()

    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            flush()
        elif stripped.startswith("#") or stripped.startswith("|"):
            flush()
        elif re.match(r"^([-*]|\d+\.)\s+", stripped):
            flush()
            current.append(re.sub(r"^([-*]|\d+\.)\s+", "", stripped))
        else:
            current.append(stripped)
    flush()

    sentences = []
    for block in blocks:
        for abbreviation in ABBREVIATIONS:
            block = block.replace(abbreviation, abbreviation.replace(".", "\x00"))
        for piece in re.split(r"(?<=[.?!])\s+", block):
            piece = piece.replace("\x00", ".").strip()
            if piece:
                sentences.append(piece)
    return sentences


def numbers_in(sentence):
    """Number tokens of a sentence, without the citations [n]."""
    return NUMBER.findall(CITATION.sub(" ", sentence))


def is_year_or_date(token):
    return bool(YEAR.fullmatch(token) or DATE.fullmatch(token))


# ----------------------------------------------------------------- checks


def result(problems, **extra):
    out = {"pass": not problems, "details": problems}
    out.update(extra)
    return out


def check_dw1(body):
    if body is None:
        return result(["no body: need a '## 1.' heading before '## Citation table'"], words=0)
    words = len(body.split())
    problems = []
    if not WORDS_MIN <= words <= WORDS_MAX:
        problems.append("%d words, need %d to %d" % (words, WORDS_MIN, WORDS_MAX))
    return result(problems, words=words)


def check_dw2(body, superplan):
    problems = []
    for n in cited_numbers(body):
        if n not in superplan:
            problems.append("[%d] is not in super-plan section 10" % n)
        elif superplan[n][1] != "verified":
            problems.append("[%d] is marked '%s' in section 10, not 'verified'" % (n, superplan[n][1]))
    return result(problems)


def check_dw3(sentences, table_lines, depth):
    problems = []
    flagged = []
    for sentence in sentences:
        numbers = cited_numbers(sentence)
        kinds = set()
        for n in numbers:
            if n not in depth:
                problems.append("[%d] is not in the status table of literature.md: %s" % (n, shorten(sentence)))
            else:
                kinds.add(depth[n])
        if "abstract only" in kinds or "index record" in kinds:
            flagged.append((", ".join(sorted(kinds & {"abstract only", "index record"})), sentence))
        if "abstract only" in kinds:
            if "abstract" not in sentence.lower():
                problems.append("cites an abstract-only paper but has no 'abstract': %s" % shorten(sentence))
            bad = [t for t in numbers_in(sentence) if not is_year_or_date(t)]
            if bad:
                problems.append(
                    "cites an abstract-only paper and has a number (%s): %s"
                    % (", ".join(bad), shorten(sentence))
                )

    cited = set()
    for sentence in sentences:
        cited.update(cited_numbers(sentence))
    rows = {}
    if table_lines is None:
        problems.append("no '## Citation table' section")
    else:
        for line in table_lines:
            match = re.match(r"^\|\s*\[(\d+)\]\s*\|\s*([^|]*?)\s*\|", line)
            if match:
                n = int(match.group(1))
                if n in rows:
                    problems.append("citation table has more than one row for [%d]" % n)
                rows[n] = match.group(2).lower()
    for n in sorted(cited):
        if n not in rows:
            problems.append("citation table has no row for [%d]" % n)
        elif n in depth and rows[n] != depth[n]:
            problems.append(
                "citation table says '%s' for [%d], literature.md says '%s'" % (rows[n], n, depth[n])
            )
    return result(problems), flagged


def check_dw4(body, sentences):
    problems = []
    for word in BANNED:
        for match in re.finditer(r"\b" + re.escape(word) + r"\b", body, flags=re.IGNORECASE):
            line = body[max(0, match.start() - 30):match.end() + 30].replace("\n", " ")
            problems.append("absolute word '%s': ...%s..." % (word, line))
    gaps = [s for s in sentences if "not proof" in s.lower()]
    if not gaps:
        problems.append("no gap sentence: no sentence has 'not proof'")
    elif not any("2026-10-24" in s and "abstracts" in s.lower() for s in gaps):
        problems.append("the gap sentence needs '2026-10-24', 'abstracts' and 'not proof' together")
    return result(problems)


def lookup(token, literature):
    pattern = r"(?<![\d.,])" + re.escape(token) + r"(?!\d)"
    return re.search(pattern, literature) is not None


def check_dw6(sentences, literature):
    missing = []
    for sentence in sentences:
        for token in numbers_in(sentence):
            if token not in missing and not lookup(token, literature):
                missing.append(token)
    problems = ["number not found in literature.md: %s" % t for t in missing]
    return result(problems), missing


def check_dw7(sentences):
    problems = []
    sized = [(len(s.split()), s) for s in sentences]
    for count, sentence in sized:
        if count > SENTENCE_MAX:
            problems.append("%d words (max %d): %s" % (count, SENTENCE_MAX, shorten(sentence)))
    longest = sorted(sized, key=lambda item: -item[0])[:5]
    return result(problems), longest


def check_refs(cited, ref_lines, superplan):
    problems = []
    seen = {}
    for line in ref_lines or []:
        match = re.match(r"^(\d+)\.\s+(.*\S)\s*$", line)
        if match:
            seen[int(match.group(1))] = match.group(2).strip()
    if ref_lines is None:
        problems.append("no '## References' section")
    for n in cited:
        if n not in seen:
            problems.append("no reference line for [%d]" % n)
    for n, line in sorted(seen.items()):
        if n not in superplan:
            problems.append("reference %d is not in super-plan section 10" % n)
        elif line != superplan[n][0]:
            problems.append("reference %d differs from super-plan section 10" % n)
    unused = [n for n in sorted(seen) if n not in cited]
    return result(problems), unused


def shorten(sentence, limit=110):
    sentence = " ".join(sentence.split())
    return sentence if len(sentence) <= limit else sentence[:limit - 3] + "..."


# ------------------------------------------------------------------- main


def read(path):
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def run(survey_path, superplan_path, literature_path):
    survey = read(survey_path)
    superplan = parse_superplan(read(superplan_path))
    literature = read(literature_path)
    depth = parse_literature(literature)
    body, table_lines, ref_lines = split_survey(survey)

    lists = {
        "abstract_or_index": [],
        "uncited_sentences": [],
        "longest": [],
        "numbers_not_found": [],
        "unused_references": [],
    }
    results = {"lists": lists}
    results["DW1"] = check_dw1(body)
    if body is None:
        for name in CHECKS[1:]:
            results[name] = result(["no body to check"])
        return results

    sentences = split_sentences(body)
    cited = cited_numbers(body)
    results["DW2"] = check_dw2(body, superplan)
    results["DW3"], lists["abstract_or_index"] = check_dw3(sentences, table_lines, depth)
    results["DW4"] = check_dw4(body, sentences)
    results["DW6"], lists["numbers_not_found"] = check_dw6(sentences, literature)
    results["DW7"], lists["longest"] = check_dw7(sentences)
    results["Refs"], lists["unused_references"] = check_refs(cited, ref_lines, superplan)
    lists["uncited_sentences"] = [
        s
        for s in sentences
        if not cited_numbers(s) and "c2" not in s.lower() and "our design" not in s.lower()
    ]
    return results


def main(survey_path, superplan_path, literature_path):
    results = run(survey_path, superplan_path, literature_path)
    for name in CHECKS:
        res = results[name]
        extra = ""
        if name == "DW1":
            extra = " words=%d (need %d to %d)" % (res.get("words", 0), WORDS_MIN, WORDS_MAX)
        print("%s %s%s" % ("PASS" if res["pass"] else "FAIL", name, extra))
        for detail in res["details"]:
            print("  - " + detail)

    lists = results["lists"]
    print()
    print("Reviewer lists")
    print("Sentences that cite an abstract-only or index-record paper (%d):" % len(lists["abstract_or_index"]))
    for kind, sentence in lists["abstract_or_index"]:
        print("  [%s] %s" % (kind, sentence))
    print("Sentences with no [n] and no 'C2' or 'our design' (%d):" % len(lists["uncited_sentences"]))
    for sentence in lists["uncited_sentences"]:
        print("  " + sentence)
    print("Five longest sentences:")
    for count, sentence in lists["longest"]:
        print("  %d words: %s" % (count, shorten(sentence, 100)))
    print("Numbers not found in literature.md: %s" % (", ".join(lists["numbers_not_found"]) or "none"))
    print("References listed but not cited: %s" % (", ".join(map(str, lists["unused_references"])) or "none"))

    return 0 if all(results[name]["pass"] for name in CHECKS) else 1


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3]))
