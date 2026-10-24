# Writing spec: P1 literature map and design decisions

Status: approved · 2026-10-23
Type: writing · Folder: `.docs/works/2026-10-23-p1-literature/`

---

## 1. Purpose

This task writes `.docs/literature.md`, the working notes for super-plan P1, Steps 1 and 3. It is not thesis text. It is the evidence that Chapter 2 (Literature Review) and Chapter 3 (Methodology) will use later.

It has two parts:
- **Map the field (Step 1).** For each reference: what it says, what it means for us, where the thesis cites it, and how deeply it was read. This covers the 27 references in super-plan §10 and a short list of recent work (2022 or later) on social recommendation, cold start and feed ranking.
- **Design decisions (Step 3).** The seven design questions from super-plan §4 (P1, Step 3). Each gets the question, the options, the evidence and our choice. P2 and P5 then start from decisions, not open questions.

Why now: the P2 blueprint and the P5 scorer need the trust formula, the prior `m`, the 1-hop or 2-hop choice and the baseline set. The committee will also ask about each of them.

**C2** in this spec means the Direction A contribution: follow-trust and community-affinity added to the engagement score in one hybrid ranking (`Thesis_Orientation.md`, line 39).

## 2. Readers

- **The author.** Reads English as a second language. Deep-reads five papers: Tang [1], SoRec [2], RealGraph [5], Sedhain [9], and Krichene and Rendle [15]. The committee will ask about these.
- **Later tasks.** `p1-supervisor-note`, `p1-related-work`, `p2-implementation-blueprint`, and the P3 and P5 designs. They quote the decisions.
- **The supervisor** sees the decisions through the one-page note (Step 4), not this file. The committee may ask to see it.

## 3. Claims

Each claim gets one status in `literature.md`: **supported** (with reference numbers), **own design**, or **not supported**. A claim may end as "not supported". The notes decide using the evidence; they do not start from the answer.

1. Each reference says what its entry says. The entry records how it was read: full text, abstract only, or index record, and the date.
2. RealGraph [5] gives directed edge weights between users, learned from past interaction data. The gate reviewer read the abstract: the weight is the *predicted probability of a future interaction*. Our trust is a plain smoothed frequency, a simpler idea in the same spirit. Super-plan §6 says RealGraph "weights the edges between users by their past interaction", which is looser than the abstract. If the notes confirm this, they propose a wording fix.
3. Twitter's open-source ranking uses user-to-user interaction weights for in-network tweets. The evidence is a file path in [6] and the repository commit hash. Not checked.
4. The smoothing with `m` is either a known technique with a source (for example from outside social recommendation), or our own design. Super-plan §6 says "my own suggestion". The literature gives the form only; the value of `m` comes from the validation sweep (E4), not from a paper.
5. The notes decide each of the three §6 choices (smoothing with `m`, the author term, one curve instead of three phases) using evidence.
6. The notes decide 1 hop or 2 hops using [3], [8] and [4]. They define "hop", say plainly that 1 hop is partly a scope choice (GNNs are out of scope, §9), and give Chapter 2 a short argument.
7. The notes decide whether BL4 and BL5 (and BL0–BL3) make the baselines strong enough, using [25], [11] and [12], and say why there is no learned baseline.
8. The notes check the protocol (leave-last-out, full ranking, as-of features, ties) against [13]–[18], item by item against the leakage cases in [14].
9. The notes say what W0, W1 and the timestamp shuffle can and cannot show, using [23] and [24].
10. We searched recent work and found no 2022-or-later paper that does what C2 does. This is a claim about our search, never "nobody has done this". The search terms, the sources searched and the date are written down.

## 4. Sources

- **References:** the 27 in super-plan §10, plus the new ones this task adds. A reference is "verified" only when the source or a trusted index was opened and the details match (the rule in §10).
- **Current status in §10:** 24 verified, 3 "search only": [5] RealGraph, [7] Twitter blog (page returned 403), [16] Cañamares (code repository only, not the paper). [23] is "verified (repository record)", weaker than opening the paper, and its repository page returned 403 to a curl check.
- **Reachable today (curl, by the gate reviewer):** [5] returned 200 and has readable text, so it can probably be opened. [6] returned 200. [7] and [23] returned 403.
- **PDF reading tool:** not checked. One reviewer read the [5] text. The other could not. Pick a working tool before the skim.
- **Newest reference today:** [4], Sharma 2024. Three are from 2023 ([6], [7], [14]). None is newer.
- **Code:** the Twitter repository [6] for claim 3. Breadit code is not read. Today's feed is taken from super-plan §3.
- **Other files:** `.docs/super-plan.md` §4–§7, `.docs/Thesis_Orientation.md`.
- **Numbers:** there are no result numbers in this task. A number from a paper is allowed when its entry names the reference and the section.

## 5. Scope

**In scope:**
- Entries for all 27 references. The depth depends on the type: abstract, method and evaluation for papers; the key function or formula for code ([6], [11]) and blog posts ([7], [12]); a 2-line entry that points to `datasets.md` for [19] and [20]. Papers behind the five core entries and the seven decisions are read in full text. The others may be 2 lines.
- Open [5], [7], [16] and [23] and mark each "verified" or "do not cite", with the replacement if any. For [7], try the Internet Archive or the blog's new address first.
- Search recent work (2022 or later) on four groups: social recommendation, social cold start, follow-graph feed ranking, and audits of feed algorithms. Include 3–5 "closest work" entries, each with how C2 differs. Add older feed-ranking neighbours (for example Facebook EdgeRank) only if a source can be verified. Write the inclusion and stop rules. Count: open question 2.
- New references are numbered [28] and later, in the §10 format.
- Use the correct DiffNet title: "A Neural Influence Diffusion Model for Social Recommendation". DiffNet is the model name. Super-plan §10 is right. `Thesis_Orientation.md` line 142 writes "DiffNet: A Neural Influence Diffusion Model…", the model name as a title prefix. It stays unchanged.
- The seven design questions of super-plan §4 (P1, Step 3), in the same wording, each naming what it decides. Each decision has: options (at least two), evidence, a source that goes against the choice (or "none found"), a label (direct, by analogy, consistent only, against), a status (decided, proposed change, open) and the §6 or config item it feeds.
- Each decision also covers:
  1. Trust: whether it should fade over time (none, half-life or window; the §6 formula has none). A "domain gap" line per source: task, data, graph type, learned or heuristic.
  2. No history: the smoothing source search, and the point that `m` is tuned, not cited.
  3. Community: label it weak support and synthetic-only. Orkut [10] recommends communities, not posts. Letting community posts into the pool changes the pool too, so two effects mix.
  4. Hops: as claim 6.
  5. Baselines: why no learned baseline (no training data in the live app, interpretability, time) as a limitation. Whether BL2, BL4 and BL5 get a small validation grid, because [25] warns about untuned baselines. A possible extra baseline "number of followees who engaged, with no trust weights" is a proposed change, not an edit.
  6. Protocol: the item-by-item check against [14]. Whether the candidate pool acts like sampling [15][16]. The number of users left out per history bucket must be reported.
  7. Built into the data: what a W1 win means (prediction, not influence). The shuffle test checks the test, not the generator. RQ2 thresholds are "in generator units" until calibrated to real data (`p1-dataset-selection`).
- For the five core papers, a reading guide: the sections to read and three questions the author should be able to answer. The five core entries come first in the file.
- **Order and stop rule.** First the five core entries and the sources behind the seven decisions. Then the new-reference search. Last the skim of the other references. If time runs short, drop in this order: new references down to 8, then the skim depth of the non-core entries (to 2 lines).

**Out of scope:**
- Dataset selection and calibration targets (`p1-dataset-selection`).
- The one-page supervisor note (`p1-supervisor-note`) and the 3–4 page survey (`p1-related-work`). No LaTeX.
- The Direction B papers in the Orientation (LLM profiles). Direction A is chosen. A short "why not learned models" paragraph is in scope, in decision 5.
- Changing super-plan §5, §6 or §7 beyond what open question 1 allows. A proposed change is only written down (open question 3).
- Editing `Thesis_Orientation.md`, `docs/` or `Latex/`. Any code.
- Deep reading of GNN papers beyond what the 1-hop or 2-hop decision needs.

## 6. Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | Compare the reference numbers in `.docs/literature.md` with §10 of `.docs/super-plan.md` | All 27 have an entry, and so does every new reference. Each entry has: what it says, what it means for us, where the thesis cites it (chapter) or "not cited", and "opened on <date>: full text, abstract only, or index record" |
| DW2 | The status table at the top of `literature.md` | [5], [7], [16] and [23] are each "verified" or "do not cite" with a named replacement. No reference marked for citation is "search only" or "abstract only" |
| DW3 | The list of new references in `literature.md` | The number agreed in open question 2. Each is from 2022 or later, has a DOI or arXiv link, and is "verified". The 3–5 closest-work entries say how C2 differs. The search terms, sources and date are written down. If a paper does what C2 does, it is a proposed change that goes to the supervisor note |
| DW4 | The seven decisions in `literature.md` | Each matches a row of the super-plan §4 table (P1, Step 3) and has every field listed in §5 (options, evidence, source against, label, status, feeds). Each choice says "supported by [n]" or "own design". A decision rests only on references read in full text, or its label says "abstract only" |
| DW5 | The three §6 choices | Smoothing with `m` and one curve are covered by the "no history" decision. The author term is covered by the "trust" decision. The smoothing is "own design" or names a source |
| DW6 | `rg -n -i 'diffnet\|neural influence' .docs/literature.md` | Every hit uses either the exact title or the bare model name "DiffNet", never "DiffNet:" as a title prefix |
| DW7 | The reading guide for [1], [2], [5], [9], [15] | Each has the sections to read and three questions. If [5] cannot be opened, the guide says so |
| DW8 | `git status --short` before the commit, `git diff --stat <commit before this task>..HEAD` after | Only `.docs/literature.md`, this task folder and, if the author agrees in open question 1, the super-plan lines named there changed. `docs/` and `Latex/` are untouched |
| DW9 | Every number in the text, except reference numbers and years | Names its source (reference and section) |
| DW10 | Every claim in §3 of this spec | Has a status in `literature.md`: supported with [n], own design, or not supported. Claim 3 has a file path and a commit hash |

## 7. Thesis link

- **Chapter and RQ:** feeds Chapter 2 (Literature Review) and Chapter 3 (Methodology: the hybrid score, the evaluation design). It serves RQ1, RQ2 and the H0 sanity world (W0, W1). Phase P1, Steps 1 and 3.
- **Frozen values touched (super-plan §7):** none changed. The decisions touch K, the history buckets, the bootstrap and permutation counts (frozen "now"), and the prior `m`, the α, β grid, the window W and the pool cap (frozen at P5). The notes may recommend a change as a "proposed change". Only the author changes a frozen value, with `/freeze`. A proposed change to a "now" value goes to the author only, not to the supervisor note.
- **Determinism class:** none (text only).
- **Changes a number reported in the thesis:** no.

## 8. Open questions

1. **Edit the super plan in this task?** The edit would be: the new references and the new "verified" marks in §10, the "search only" sentence in line 136, the version (0.5) and a change-log line, and the citation marks in §6 (line 294) if [5] or [7] becomes "do not cite" or the RealGraph wording needs a fix. I recommend yes: the status then lives in one place, and `p1-related-work` can cite only "verified" references as the rule requires. The other option is to keep everything in `literature.md` and edit the super plan at the end of P1. Do you agree to the first option?
2. **How many new references (2022 or later)?** I recommend about 8–12, and at least half from 2024 or later. Fewer than 8 is too thin for a survey. More than 12 is more than the time allows, because every new reference must be opened to be "verified". Is that range right?
3. **If the evidence says a choice in §5 or §6 is wrong** (for example the trust formula, the window W or the split). I recommend that the notes write it as a "proposed change" and nothing in the super plan changes until you agree. Do you agree?
4. **Full texts.** Many sources are paywalled (ACM, Springer). Decisions rest only on full-text reads. Can you get the paywalled ones through the university library if a fetch returns only the abstract? If not, those entries stay "abstract only" and cannot support a decision.

## Review notes

Gate review and committee review ran on 2026-10-23. I fixed these in the spec: DW2 and DW8 (they could not pass), the "do not cite" path for [5] and [7] (now in open question 1), the definition of C2, the wording of claims 2, 3 and 6–10 (decide using evidence, not start from the answer), RealGraph as a learned predicted probability, the full list of frozen values, the DW1 entry format, [23] in scope, the DW6 command, the new-reference count and numbering, the order and stop rule, and the per-decision fields (source against, label, status). I also added to scope the points from the committee: decay, "hop", why no learned baseline, the pool as sampling, and what a W1 win means.

Left open:
- **Reading depth.** I cannot confirm from here that a PDF text tool works on this Mac. One reviewer read the [5] text, the other could not. The first step of the work must check this. If no tool works, PDF-only sources stay "abstract only".
- **A real answer to "why a heuristic, not a learned model?"** The notes can only give reasons and call it a limitation. The reasons are weak against [25] if the baselines stay untuned. Decision 5 must say clearly what is and is not tuned.
- **Possible gap in the baselines.** BL0–BL5 have no personalised baseline. The "engaging followees" baseline is only a proposal. The author decides.
- **Old neighbours.** EdgeRank is added only if a verifiable source exists. If not, Chapter 2 cannot cite it.
