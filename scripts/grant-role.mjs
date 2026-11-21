#!/usr/bin/env node
// Bootstrap: give a staff role to an existing account (e.g. the first admin).
// Run by an operator with direct database access; the change is written to audit_logs.
//   DATABASE_URL=postgresql://... node scripts/grant-role.mjs admin@example.kz admin
import postgres from 'postgres';

const [email, role] = process.argv.slice(2);
const ROLES = ['parent', 'content_manager', 'reviewer', 'admin', 'support'];
if (!email || !ROLES.includes(role)) {
  console.error(`usage: node scripts/grant-role.mjs <email> <${ROLES.join('|')}>`);
  process.exit(2);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(2);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const rows = await sql`
    update public.profiles p set role = ${role}::public.app_role
      from auth.users u
     where u.id = p.id and lower(u.email) = lower(${email}) and p.role <> 'student'
    returning p.id`;
  if (!rows.length) {
    console.error('no such non-student account; the user must register first');
    process.exit(1);
  }
  console.log(`role of ${email} set to ${role}`);
} finally {
  await sql.end();
}
