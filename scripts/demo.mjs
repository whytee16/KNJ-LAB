#!/usr/bin/env node
// Local demo of KNJ LAB on your own computer (only fake data, only the local Supabase stack).
//   pnpm demo         — fresh start: reset the local database, load drafts, create test accounts, run the site
//   pnpm demo:start   — run again keeping your data (after a restart of the computer)
// Requirements: Docker Desktop (running), Node.js 22+, pnpm. See docs/demo.md.
import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const fresh = !process.argv.includes('--keep');
const PASSWORD = 'Demo2026knj';
const ACCOUNTS = {
  student: { login: 'demo.uchenik', name: 'Тестовый ученик', grade: 9 },
  parent: { email: 'roditel@demo.local', name: 'Тестовый родитель' },
  reviewer: { email: 'metodist@demo.local', name: 'Тестовый методист' },
};

const say = (msg) => console.log(`\n▶ ${msg}`);
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: opts.capture ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    encoding: 'utf8',
    env: { ...process.env, ...opts.env },
  });
  if (r.status !== 0 && !opts.allowFail)
    fail(opts.error ?? `Команда не выполнилась: ${cmd} ${args.join(' ')}`);
  return r;
}

// 1. Environment checks
const major = Number(process.versions.node.split('.')[0]);
if (major < 22)
  fail(
    `Нужен Node.js 22 или новее (сейчас ${process.versions.node}). Установите LTS-версию с nodejs.org.`,
  );
if (run('docker', ['info'], { capture: true, allowFail: true }).status !== 0)
  fail(
    'Docker не запущен. Откройте Docker Desktop, дождитесь зелёного статуса «Running» и повторите.',
  );

// 2. Local Supabase stack
say('Запускаю локальную базу (первый раз скачивание образов займёт 5–10 минут)…');
run('pnpm', ['exec', 'supabase', 'start'], {
  error:
    'Не удалось запустить локальную базу. Убедитесь, что Docker Desktop работает, и повторите.',
});
const status = JSON.parse(
  run('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { capture: true }).stdout,
);
const API_URL = status.API_URL;
const DB_URL = status.DB_URL;
if (
  !/^(https?|postgresql):\/\/(127\.0\.0\.1|localhost)[:/]/.test(API_URL) ||
  !/(127\.0\.0\.1|localhost)/.test(DB_URL)
)
  fail('Демо работает только с локальной базой на этом компьютере.');

if (fresh) {
  say('Создаю чистую базу…');
  run('pnpm', ['exec', 'supabase', 'db', 'reset']);
}

// 3. App settings (local demo keys of `supabase start`, not secrets; the file is git-ignored)
writeFileSync(
  join(root, 'apps/web/.env.local'),
  [
    '# Local demo (pnpm demo). Keys are the public defaults of the local Supabase stack.',
    'APP_URL=http://localhost:3000',
    `NEXT_PUBLIC_SUPABASE_URL=${API_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${status.ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
    'IP_HASH_SALT=local-demo-salt-not-a-secret',
    'REGISTRATION_ENABLED=true',
    '',
  ].join('\n'),
);

if (fresh) {
  // 4. Drafts (ai_draft: a reviewer confirms and publishes them in the studio)
  say('Загружаю учебные черновики (их нужно проверить и опубликовать методистом)…');
  run('node', ['--experimental-strip-types', '--no-warnings', 'scripts/import-drafts.ts'], {
    env: { DATABASE_URL: DB_URL },
  });

  // 5. Test accounts
  say('Создаю тестовые аккаунты…');
  const { default: postgres } = await import('postgres');
  const sql = postgres(DB_URL, { max: 1, onnotice: () => {} });
  const createUser = async (email, name) => {
    const res = await fetch(`${API_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: status.SERVICE_ROLE_KEY,
        Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: name },
      }),
    });
    if (!res.ok) fail(`Не удалось создать ${email}: ${await res.text()}`);
    return (await res.json()).id;
  };
  try {
    const parentId = await createUser(ACCOUNTS.parent.email, ACCOUNTS.parent.name);
    const studentId = await createUser(
      `${ACCOUNTS.student.login}@student.knj.invalid`,
      ACCOUNTS.student.name,
    );
    await sql`select public.register_student(${studentId}, ${parentId}, ${ACCOUNTS.student.login}, ${ACCOUNTS.student.grade}::smallint, ${ACCOUNTS.student.name}, 'dev-0')`;
    await sql`insert into public.consents (subject_profile_id, given_by_profile_id, type, document_version) values (${parentId}, ${parentId}, 'pd_processing', 'dev-0')`;
    await sql`insert into public.entitlements (student_id, ends_at, reason) values (${studentId}, now() + interval '365 days', 'Демо-доступ')`;
    const reviewerId = await createUser(ACCOUNTS.reviewer.email, ACCOUNTS.reviewer.name);
    await sql`update public.profiles set role = 'reviewer' where id = ${reviewerId}`;
  } finally {
    await sql.end();
  }
  const note = [
    '# Тестовые аккаунты локального демо (только на этом компьютере)',
    '',
    `Сайт: http://localhost:3000`,
    '',
    `- Ученик (с пропуском на год): логин \`${ACCOUNTS.student.login}\`, пароль \`${PASSWORD}\``,
    `- Методист (студия): \`${ACCOUNTS.reviewer.email}\`, пароль \`${PASSWORD}\` — при первом входе подключите Google Authenticator`,
    `- Родитель ученика: \`${ACCOUNTS.parent.email}\`, пароль \`${PASSWORD}\``,
    '',
    'Письма (сброс пароля и т. п.) приходят в локальный почтовый ящик: http://127.0.0.1:54324',
    '',
  ].join('\n');
  writeFileSync(join(root, 'DEMO-ACCOUNTS.md'), note);
}

// 6. Build and run
say('Собираю сайт (1–3 минуты)…');
run('pnpm', ['--filter', '@knj/web', 'build']);
console.log(`
✔ Готово. Откройте в браузере: http://localhost:3000
  Ученик:   ${ACCOUNTS.student.login} / ${PASSWORD}
  Методист: ${ACCOUNTS.reviewer.email} / ${PASSWORD}
  ${existsSync(join(root, 'DEMO-ACCOUNTS.md')) ? 'Аккаунты записаны в DEMO-ACCOUNTS.md.' : ''}
  Остановить сайт — Ctrl+C. Остановить базу — pnpm db:stop.
`);
run('pnpm', ['--filter', '@knj/web', 'start', '-p', '3000']);
