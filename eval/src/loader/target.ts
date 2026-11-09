// Where the loader writes (design: Approach). The target is always its own Postgres schema, never `public` or `it_test`.
// The URL's own `schema` parameter is never trusted: targetUrl overwrites it with a name that passed SCHEMA_NAME.

export const DEFAULT_SCHEMA = "eval_load";
// The Docker default, the same as .claude/hooks/run-safe.sh and apps/backend/test/it/env.ts. .env is never read.
export const DEFAULT_BASE_URL = "postgresql://breadit:breaditpassword@localhost:5433/breadit";

const SCHEMA_NAME = /^eval_[a-z0-9_]+$/;

function checkSchema(name: string): string {
  if (!SCHEMA_NAME.test(name)) {
    throw new Error(`schema "${name}" is not allowed: the loader writes only to a schema named eval_ plus lower case letters, digits or underscores (for example eval_load)`);
  }
  return name;
}

/** The base URL with its `schema` parameter replaced by `schema`. Throws when the name is not an eval_ name. */
export function targetUrl(base: string, schema: string): string {
  checkSchema(schema);
  const url = new URL(base);
  url.searchParams.set("schema", schema);
  return url.toString();
}

/** The schema of a target URL. Throws when the URL has no schema or a name that targetUrl would refuse. */
export function schemaOf(url: string): string {
  const name = new URL(url).searchParams.get("schema");
  if (name === null) throw new Error("the database URL has no schema parameter: build it with targetUrl");
  return checkSchema(name);
}
