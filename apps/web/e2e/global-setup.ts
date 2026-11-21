import postgres from 'postgres';

/**
 * Clears rate-limit counters in the LOCAL test database so repeated runs from 127.0.0.1 do not
 * trip the login limiter. Refuses to touch anything but a local database.
 */
export default async function globalSetup() {
  const url =
    process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const host = new URL(url).hostname;
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error(`global-setup only resets a local database, got host ${host}`);
  }
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await sql`delete from private.rate_limits`;
  } catch (e) {
    // No local database (landing-only runs): nothing to reset.
    if (!/ECONNREFUSED|does not exist/.test(String(e))) throw e;
  } finally {
    await sql.end();
  }
}
