# Gate result: p7-hive-check

**Verdict: FAIL.** BigQuery could not run on the SoChainDB dataset, so the gate number was never counted (design F1). Date: 2026-11-12.

## What was run

The author opened a BigQuery sandbox project (no billing) in the Google Cloud console and ran two queries.

| Query | Text | Result |
|---|---|---|
| Q0a | `SELECT table_id, row_count, size_bytes FROM steemit-307308.hive_zurich.__TABLES__ ORDER BY table_id` | `Access Denied: Table steemit-307308:hive_zurich.__TABLES__: User does not have permission to query table steemit-307308:hive_zurich.__TABLES__, or perhaps it does not exist.` Missing permission: `bigquery.tables.getData` on project `steemit-307308`. |
| Data check | `SELECT timestamp FROM steemit-307308.hive_zurich.block_data_48000001_50000000_33 LIMIT 5` (a table named in the SoChainDB README) | The same error for that table: `bigquery.tables.getData` on project `steemit-307308`. |

Starring the project `steemit-307308` in the console also failed ("Error starring resource"). So the dataset is no longer readable by an outside account. This is a missing grant on the owner's side; billing would not change it. Q1–Q6 were never written, and no Hive row was downloaded.

## Other source checked: HiveSQL

Checked on 2026-11-12 from https://hivesql.io/about/, https://hivesql.io/monthly-subscription/, https://hivesql.io/daily-subscription/, https://hivesql.io/registration/ and https://docs.hivesql.io.

- It is paid: "the HiveSQL proposal is not funded which means that its use cannot be provided for free". Registration is 1 HBD, then 5 HBD a day, or 50 HBD a month (the page's button says 40). Payment needs a Hive account holding HBD.
- `CommunitiesSubscribers` (community, subscriber) and `Followers` (follower, following) hold only the current state. The docs say `Followers` "does not allow one to know when an account started or stopped to follow another account". Join and follow times could only come from `TxCustoms`, and its docs page lists no time column. So the frozen as-of rule (a membership counts only with `joined_at < t_u`) cannot be checked from the docs.
- The docs do not state the history range, the query limits or any rule on publishing extracted data.
- Using it means a new source, so a new Spec and Design, plus buying HBD. This does not fit before the gate's end date (11-14).

## Decision

By the author, 2026-11-12: close the task with the gate failed. The community term keeps only synthetic evidence (decision Q2 of 2026-10-26 stays), and Hive goes to future work with what was checked here. The transform (`hive-transform.ts`) and the gate script (`gate.ts`), with their 26 tests, stay in this folder for later use.
