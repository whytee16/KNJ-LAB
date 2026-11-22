'use server';

import { isLocale, type Locale } from '@knj/i18n';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/authz';
import { activePass } from '@/server/entitlements';
import { finishTest, startOrResumeTest } from './attempt-server';
import { needsPass, parseCounts } from './scope';

function localeOf(form: FormData): Locale {
  const v = form.get('locale');
  return typeof v === 'string' && isLocale(v) ? v : 'ru';
}

export async function startTest(form: FormData): Promise<void> {
  const locale = localeOf(form);
  const testId = z.uuid().safeParse(form.get('testId'));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'student' || !testId.success) redirect(`/${locale}/app/tests`);
  const { data: test } = await createAdminClient()
    .from('tests')
    .select('counts')
    .eq('id', testId.data)
    .eq('status', 'published')
    .maybeSingle();
  if (!test) redirect(`/${locale}/app/tests`);
  if (needsPass(parseCounts(test.counts)) && !(await activePass(user.id)))
    redirect(`/${locale}/app/tests?locked=1`);
  const attemptId = await startOrResumeTest(user.id, testId.data, locale);
  redirect(`/${locale}/app/tests/run/${attemptId}`);
}

const answersSchema = z.record(
  z.uuid(),
  z.union([
    z.string().max(2000),
    z.array(z.string().max(20)).max(20),
    z.record(z.string().max(20), z.string().max(20)),
  ]),
);

export async function submitTest(form: FormData): Promise<void> {
  const locale = localeOf(form);
  const attemptId = z.uuid().safeParse(form.get('attemptId'));
  const user = await getCurrentUser();
  if (!user || user.role !== 'student' || !attemptId.success) redirect(`/${locale}/app/tests`);
  let answers: z.infer<typeof answersSchema> = {};
  try {
    answers = answersSchema.parse(JSON.parse(String(form.get('answers') ?? '{}')));
  } catch {
    answers = {};
  }
  const outcome = await finishTest(user.id, attemptId.data, answers);
  if (outcome === 'not_found') redirect(`/${locale}/app/tests`);
  redirect(`/${locale}/app/results/${attemptId.data}`);
}
