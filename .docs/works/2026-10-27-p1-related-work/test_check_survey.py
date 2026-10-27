"""Tests for check_survey.py (TC1 to TC11 of plan.md).

Run from the repo root:
    python3 -I .docs/works/2026-10-27-p1-related-work/test_check_survey.py

With -I the script folder is not on the import path, so the checker is
loaded by its file path. Fixtures are written to temporary folders.
Standard library only.
"""

import contextlib
import importlib.util
import io
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
CHECKER_PATH = os.path.join(HERE, "check_survey.py")


def load_checker():
    spec = importlib.util.spec_from_file_location("check_survey", CHECKER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------- fixtures

SUPERPLAN = """# Super-plan (fixture)

## 9. Out of scope

1. Decoy line that is not a reference · wrong

## 10. Appendix: references

"Verified" means the source was opened. "Search only" means a snippet was seen.

1. Tang, Hu, Liu (2013). Social recommendation: a review. *SNAM* 3(4). https://doi.org/10.1007/x · verified
2. Ma, Yang, Lyu, King (2008). SoRec. *CIKM*. https://doi.org/10.1145/y · verified (abstract only; do not cite a finding from it)
3. Wu et al. (2019). A neural influence diffusion model for social recommendation (DiffNet). *SIGIR*. https://arxiv.org/abs/1904.10322 · verified
4. Sharma et al. (2024). A survey of graph neural networks for social recommender systems. *ACM CSUR* 56(10). https://doi.org/10.1145/z · verified
8. Jamali, Ester (2010). A matrix factorization technique with trust propagation (SocialMF). *RecSys*. https://doi.org/10.1145/w · verified
9. Sedhain et al. (2014). Social collaborative filtering for cold-start recommendations. *RecSys*. https://example.org/9 · verified
47. Mislove et al. (2007). Measurement and analysis of online social networks. *IMC*. https://example.org/47 · search only (do not cite)
48. Somebody (2020). A paper with a bad record. https://example.org/48 · do not cite

---

## 11. Open items

1. Not a reference.
"""

LITERATURE = """# Literature notes (fixture)

## 1. Status table

| Ref | Short name | Type | Verified | Read | Opened | Cited in |
|---|---|---|---|---|---|---|
| [1] | Social recommendation review (Tang 2013) | survey | verified | abstract only | 2026-10-24 | not cited |
| [2] | SoRec (Ma 2008) | paper | verified | abstract only | 2026-10-24 | not cited |
| [3] | DiffNet (Wu 2019) | paper | verified | full text | 2026-10-24 | Ch2 |
| [4] | GNN survey (Sharma 2024) | survey | verified | full text | 2026-10-24 | Ch2 |
| [8] | SocialMF (Jamali 2010) | paper | verified | index record | 2026-10-24 | not cited |

## 2. Claims

K = 2 is best on two data sets. The survey annotates 2,151 papers and finds 84.
The ranking changes with the split, Kendall's tau 0.5284 to 0.7630. The change in
accuracy is as large as 89.5%. Tang 2013, Ma 2008, Wu 2019, Sharma 2024.
Search date 2026-10-24.
"""

# What a clean survey says. Each value is a list of sentences.
CLEAN_PARTS = {
    1: [
        "The abstract says Tang, Hu and Liu review social recommendation [1].",
        "According to its abstract, SoRec uses a social network and ratings together [2].",
        "DiffNet mixes user embeddings for K steps, and K = 2 is best on two data sets [3].",
        "A survey of 84 papers out of 2,151 was made [4].",
        "SocialMF is named here [8].",
    ],
    2: [
        "Our design uses one hop and plain counts.",
        "C2 is in the spirit of RealGraph and has no learned model.",
    ],
    3: [
        "The search of 2026-10-24 found, by the abstracts, no paper that adds follow "
        "trust and community affinity to engagement in one feed ranking, but this is not proof.",
    ],
    4: [
        "The ranking of models changes with the split, with Kendall tau from 0.5284 to 0.7630 [3].",
        "Future data in training changes accuracy by as much as 89.5% [3].",
    ],
}
CLEAN_GAP = CLEAN_PARTS[3][0]

HEADINGS = {
    1: "## 1. Social recommendation",
    2: "## 2. Feed ranking and communities in industry",
    3: "## 3. Recent work and what C2 adds",
    4: "## 4. Offline evaluation of recommenders",
}

DEFAULT_TABLE = {
    1: ("abstract only", "What the abstract says about the review."),
    2: ("abstract only", "What the abstract says about SoRec."),
    3: ("full text", "DiffNet and its depth result."),
    4: ("full text", "The survey of graph models."),
    8: ("index record", "Name only."),
}

# The lines of section 10 as the survey must copy them (text before " · ").
SUPERPLAN_LINES = {}
_in_section = False
for _line in SUPERPLAN.splitlines():
    if _line.startswith("## 10."):
        _in_section = True
    elif _line.startswith("## 11.") or _line == "---":
        _in_section = False
    elif _in_section and _line[:1].isdigit():
        SUPERPLAN_LINES[int(_line.split(".", 1)[0])] = _line.split(" · ")[0]


def filler(n):
    """Exactly n words in sentences of at most 10 words, each with C2."""
    if n < 0:
        raise ValueError("core text is longer than the target: %d" % n)
    if n == 0:
        return ""
    full, rest = divmod(n, 10)
    sentences = ["C2 uses a plain count and a small rule here."] * full
    if rest:
        sentences.append(" ".join(["C2"] + ["word"] * (rest - 1)) + ".")
    return " ".join(sentences)


def build_survey(target=1800, extra="", gap=None, table=None, refs=None):
    """A survey text. `target` is the exact word count of the body."""
    parts = {k: list(v) for k, v in CLEAN_PARTS.items()}
    if gap is not None:
        parts[3] = [gap] if gap else []
    chunks = []
    for k in (1, 2, 3, 4):
        chunks.append(HEADINGS[k])
        chunks.append(" ".join(parts[k]))
    if extra:
        chunks.append(extra)
    core = "\n\n".join(chunks)
    pad = target - len(core.split()) if target is not None else 0
    body = core + ("\n\n" + filler(pad) if pad else "")

    if table is None:
        table = DEFAULT_TABLE
    rows = ["| Ref | Depth | What the survey says |", "|---|---|---|"]
    for n in sorted(table):
        depth, says = table[n]
        rows.append("| [%d] | %s | %s |" % (n, depth, says))

    if refs is None:
        refs = [SUPERPLAN_LINES[n] for n in (1, 2, 3, 4, 8)]

    return (
        "# Related work\n\nA draft. C2 is a hybrid score.\n\n"
        + body
        + "\n\n## Citation table\n\n"
        + "\n".join(rows)
        + "\n\n## References\n\n"
        + "\n".join(refs)
        + "\n"
    )


class Base(unittest.TestCase):
    def setUp(self):
        self.cs = load_checker()
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.dir = self._tmp.name
        self.superplan_path = self._write("super-plan.md", SUPERPLAN)
        self.literature_path = self._write("literature.md", LITERATURE)

    def _write(self, name, text):
        path = os.path.join(self.dir, name)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text)
        return path

    def snapshot(self):
        out = {}
        for name in os.listdir(self.dir):
            with open(os.path.join(self.dir, name), "rb") as handle:
                out[name] = handle.read()
        return out

    def survey_path(self, text):
        return self._write("related-work.md", text)

    def run_survey(self, text):
        return self.cs.run(
            self.survey_path(text), self.superplan_path, self.literature_path
        )

    def assertPass(self, res, name):
        self.assertTrue(res[name]["pass"], "%s should pass: %s" % (name, res[name]["details"]))

    def assertFail(self, res, name):
        self.assertFalse(res[name]["pass"], "%s should fail" % name)


# ------------------------------------------------------------------- tests


class TC1_WordCount(Base):
    def test_limits(self):
        for target, expected in ((1499, False), (1500, True), (2200, True), (2201, False)):
            with self.subTest(words=target):
                res = self.run_survey(build_survey(target=target))
                self.assertEqual(res["DW1"]["pass"], expected, res["DW1"]["details"])

    def test_table_and_references_are_not_counted(self):
        big_table = dict(DEFAULT_TABLE)
        big_table[1] = ("abstract only", " ".join(["word"] * 400))
        res = self.run_survey(build_survey(target=1499, table=big_table))
        self.assertFail(res, "DW1")
        res = self.run_survey(build_survey(target=1500, table=big_table))
        self.assertPass(res, "DW1")


class TC2_References(Base):
    def test_search_only_fails(self):
        res = self.run_survey(build_survey(extra="The record is named here [47]."))
        self.assertFail(res, "DW2")
        self.assertIn("47", " ".join(res["DW2"]["details"]))

    def test_do_not_cite_fails(self):
        res = self.run_survey(build_survey(extra="The record is named here [48]."))
        self.assertFail(res, "DW2")

    def test_number_missing_from_superplan_fails(self):
        res = self.run_survey(build_survey(extra="The record is named here [99]."))
        self.assertFail(res, "DW2")
        self.assertIn("99", " ".join(res["DW2"]["details"]))

    def test_comma_form_is_two_references(self):
        self.assertEqual(self.cs.cited_numbers("A [3, 4] and B [5][6]."), [3, 4, 5, 6])
        res = self.run_survey(build_survey(extra="Both are named here [3, 99]."))
        self.assertFail(res, "DW2")
        self.assertIn("99", " ".join(res["DW2"]["details"]))

    def test_decoy_line_of_another_section_is_not_a_reference(self):
        # fixture has "1." under section 9 with the status word "wrong"
        res = self.run_survey(build_survey())
        self.assertPass(res, "DW2")


class TC3_AbstractNumbers(Base):
    def test_number_in_abstract_only_sentence_fails(self):
        res = self.run_survey(
            build_survey(extra="The abstract says SoRec scales to 120 users [2].")
        )
        self.assertFail(res, "DW3")

    def test_year_is_allowed(self):
        res = self.run_survey(
            build_survey(extra="The abstract says SoRec was presented in 2008 [2].")
        )
        self.assertPass(res, "DW3")

    def test_full_text_sentence_may_have_numbers(self):
        res = self.run_survey(build_survey(extra="DiffNet reports K = 2 as best [3]."))
        self.assertPass(res, "DW3")


class TC4_AbstractWord(Base):
    def test_no_abstract_word_fails(self):
        res = self.run_survey(build_survey(extra="SoRec uses a social network [2]."))
        self.assertFail(res, "DW3")

    def test_index_record_sentence_is_listed(self):
        text = "SocialMF is a method for trust propagation [8]."
        res = self.run_survey(build_survey(extra=text))
        listed = " ".join(str(item) for item in res["lists"]["abstract_or_index"])
        self.assertIn("SocialMF is a method for trust propagation", listed)

    def test_abstract_sentences_are_listed(self):
        res = self.run_survey(build_survey())
        listed = " ".join(str(item) for item in res["lists"]["abstract_or_index"])
        self.assertIn("SoRec uses a social network and ratings together", listed)


class TC5_Table(Base):
    def test_ref_not_in_status_table_fails(self):
        # [9] is verified in the super-plan but has no row in the status table
        res = self.run_survey(build_survey(extra="The abstract names a study [9]."))
        self.assertPass(res, "DW2")
        self.assertFail(res, "DW3")

    def test_search_only_ref_not_in_status_table_fails(self):
        res = self.run_survey(build_survey(extra="The abstract names a study [47]."))
        self.assertFail(res, "DW3")

    def test_depth_differs_from_status_table_fails(self):
        table = dict(DEFAULT_TABLE)
        table[3] = ("abstract only", "DiffNet.")
        res = self.run_survey(build_survey(table=table))
        self.assertFail(res, "DW3")

    def test_cited_ref_without_row_fails(self):
        table = dict(DEFAULT_TABLE)
        del table[4]
        res = self.run_survey(build_survey(table=table))
        self.assertFail(res, "DW3")

    def test_duplicate_row_fails(self):
        text = build_survey().replace(
            "| [4] | full text | The survey of graph models. |",
            "| [4] | full text | The survey of graph models. |\n| [4] | full text | Again. |",
        )
        res = self.run_survey(text)
        self.assertFail(res, "DW3")


class TC6_Absolute(Base):
    def test_banned_words_fail(self):
        for word in ("no one", "nobody", "first", "never", "novel", "unique"):
            with self.subTest(word=word):
                extra = "Our design says that %s did this." % word
                res = self.run_survey(build_survey(extra=extra))
                self.assertFail(res, "DW4")

    def test_banned_words_are_case_insensitive(self):
        res = self.run_survey(build_survey(extra="Nobody did this, says our design."))
        self.assertFail(res, "DW4")

    def test_whole_words_only(self):
        extra = "Firstly, C2 is simple. The worst case is rare and C2 knows it."
        res = self.run_survey(build_survey(extra=extra))
        self.assertPass(res, "DW4")

    def test_gap_sentence_without_date_fails(self):
        gap = (
            "The search found, by the abstracts, no paper that adds follow trust "
            "and community affinity to engagement, but this is not proof."
        )
        res = self.run_survey(build_survey(gap=gap))
        self.assertFail(res, "DW4")

    def test_gap_sentence_without_not_proof_fails(self):
        gap = (
            "The search of 2026-10-24 found, by the abstracts, no paper that adds "
            "follow trust and community affinity to engagement."
        )
        res = self.run_survey(build_survey(gap=gap))
        self.assertFail(res, "DW4")

    def test_missing_gap_sentence_fails(self):
        res = self.run_survey(build_survey(gap=""))
        self.assertFail(res, "DW4")

    def test_clean_gap_sentence_passes(self):
        res = self.run_survey(build_survey())
        self.assertPass(res, "DW4")


class TC7_Numbers(Base):
    def test_number_not_in_literature_fails_and_is_printed(self):
        res = self.run_survey(build_survey(extra="C2 has 777 users."))
        self.assertFail(res, "DW6")
        self.assertIn("777", res["lists"]["numbers_not_found"])

    def test_numbers_with_comma_point_and_percent_are_one_number(self):
        extra = "C2 saw 2,151 posts, a tau of 0.5284 and a change of 89.5% in our design."
        res = self.run_survey(build_survey(extra=extra))
        self.assertPass(res, "DW6")

    def test_changed_number_is_printed_whole(self):
        for number in ("2,152", "2.5284", "89.6%"):
            with self.subTest(number=number):
                res = self.run_survey(build_survey(extra="C2 shows %s in our design." % number))
                self.assertFail(res, "DW6")
                self.assertIn(number, res["lists"]["numbers_not_found"])

    def test_year_is_checked_too(self):
        res = self.run_survey(build_survey(extra="C2 was made in 1999 in our design."))
        self.assertFail(res, "DW6")
        self.assertIn("1999", res["lists"]["numbers_not_found"])
        res = self.run_survey(build_survey(extra="C2 was made after 2013 in our design."))
        self.assertPass(res, "DW6")

    def test_citations_and_headings_are_not_numbers(self):
        # "[47]" and "## 1." must not be read as numbers
        res = self.run_survey(build_survey(extra="The abstract names a study [47]."))
        self.assertNotIn("47", res["lists"]["numbers_not_found"])
        self.assertNotIn("1", res["lists"]["numbers_not_found"])


class TC8_SentenceLength(Base):
    @staticmethod
    def sentence(n, with_marks=False):
        words = ["C2"] + ["word"] * (n - 1)
        if with_marks:
            words[3] = "e.g."
            words[5] = "[3]"
        return " ".join(words) + "."

    def test_36_words_fails_35_passes(self):
        res = self.run_survey(build_survey(extra=self.sentence(36)))
        self.assertFail(res, "DW7")
        res = self.run_survey(build_survey(extra=self.sentence(35)))
        self.assertPass(res, "DW7")

    def test_abbreviation_and_citation_do_not_split(self):
        res = self.run_survey(build_survey(extra=self.sentence(36, with_marks=True)))
        self.assertFail(res, "DW7")
        res = self.run_survey(build_survey(extra=self.sentence(35, with_marks=True)))
        self.assertPass(res, "DW7")

    def test_longest_five_are_listed(self):
        res = self.run_survey(build_survey(extra=self.sentence(30)))
        longest = res["lists"]["longest"]
        self.assertEqual(len(longest), 5)
        self.assertEqual(longest[0][0], 30)


class TC9_ReferenceLines(Base):
    def test_changed_line_fails(self):
        refs = [SUPERPLAN_LINES[n] for n in (1, 2, 3, 4, 8)]
        refs[2] = refs[2].replace("A neural influence", "A NEURAL influence")
        res = self.run_survey(build_survey(refs=refs))
        self.assertFail(res, "Refs")

    def test_missing_reference_fails(self):
        refs = [SUPERPLAN_LINES[n] for n in (1, 2, 3, 8)]
        res = self.run_survey(build_survey(refs=refs))
        self.assertFail(res, "Refs")

    def test_reference_not_in_superplan_fails(self):
        refs = [SUPERPLAN_LINES[n] for n in (1, 2, 3, 4, 8)] + ["77. Ghost (2000). Nothing."]
        res = self.run_survey(build_survey(refs=refs))
        self.assertFail(res, "Refs")

    def test_uncited_reference_is_listed_not_failed(self):
        refs = [SUPERPLAN_LINES[n] for n in (1, 2, 3, 4, 8, 9)]
        res = self.run_survey(build_survey(refs=refs))
        self.assertPass(res, "Refs")
        self.assertIn(9, res["lists"]["unused_references"])


class TC10_NoCitation(Base):
    def test_sentence_without_citation_is_listed(self):
        text = "Edge ranking was common in older systems."
        res = self.run_survey(build_survey(extra=text))
        listed = " ".join(res["lists"]["uncited_sentences"])
        self.assertIn("Edge ranking was common in older systems", listed)

    def test_c2_or_our_design_sentence_is_not_listed(self):
        res = self.run_survey(build_survey(extra="Our design counts plain events. C2 is small."))
        listed = " ".join(res["lists"]["uncited_sentences"])
        self.assertNotIn("Our design counts plain events", listed)
        self.assertNotIn("C2 is small", listed)

    def test_cited_sentence_is_not_listed(self):
        res = self.run_survey(build_survey())
        listed = " ".join(res["lists"]["uncited_sentences"])
        self.assertNotIn("SocialMF is named here", listed)


class TC11_Clean(Base):
    def test_clean_survey_passes_everything(self):
        res = self.run_survey(build_survey())
        for name in ("DW1", "DW2", "DW3", "DW4", "DW6", "DW7", "Refs"):
            self.assertPass(res, name)

    def test_main_prints_pass_and_returns_zero(self):
        path = self.survey_path(build_survey())
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = self.cs.main(path, self.superplan_path, self.literature_path)
        self.assertEqual(code, 0)
        self.assertNotIn("FAIL", out.getvalue())
        for name in ("DW1", "DW2", "DW3", "DW4", "DW6", "DW7", "Refs"):
            self.assertIn("PASS " + name, out.getvalue())

    def test_main_returns_one_and_prints_fail(self):
        path = self.survey_path(build_survey(extra="Nobody did this, says our design."))
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = self.cs.main(path, self.superplan_path, self.literature_path)
        self.assertEqual(code, 1)
        self.assertIn("FAIL DW4", out.getvalue())

    def test_checker_writes_nothing(self):
        path = self.survey_path(build_survey())
        before = self.snapshot()
        with contextlib.redirect_stdout(io.StringIO()):
            self.cs.main(path, self.superplan_path, self.literature_path)
        after = self.snapshot()
        self.assertEqual(before, after)

    def test_command_line(self):
        path = self.survey_path(build_survey())
        done = subprocess.run(
            [sys.executable, "-I", CHECKER_PATH, path, self.superplan_path, self.literature_path],
            capture_output=True,
            text=True,
        )
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertIn("PASS DW1", done.stdout)


if __name__ == "__main__":
    unittest.main()
