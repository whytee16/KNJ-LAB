'use server';

import { isLocale, type Locale } from '@knj/i18n';
import { labModel, parseParams } from '@knj/physics';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/authz';
import { hit } from '@/server/rate-limit';
import { labAccess, usableQuestions } from './access';
import { getLab } from './queries';
import { openLabAttemptId } from './server';

const saveSchema = z.object({
  code: z.string().max(60),
  sessionId: z.uuid().nullable(),
  params: z.unknown(),
  durationS: z.number().int().min(0).max(86_400),
});

export type SaveLabResult = { ok: true; sessionId: string } | { ok: false };

/**
 * Saves the student's lab parameters and time spent. Parameters are re-validated against the
 * model; the duration is capped by the time elapsed since the session started on the server.
 */
export async function saveLabSession(input: unknown): Promise<SaveLabResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const model = labModel(parsed.data.code);
  const user = await getCurrentUser();
  if (!model || !user || user.role !== 'student') return { ok: false };
  const lab = await getLab(parsed.data.code, 'ru');
  if (!lab || lab.status !== 'published') return { ok: false };
  if (!(await labAccess(lab, user)).student) return { ok: false };
  if (!(await hit('labSave', `student:${user.id}`))) return { ok: false };

  const params = parseParams(model, parsed.data.params);
  const attemptId = await openLabAttemptId(user.id, lab.id);
  const admin = createAdminClient();

  if (parsed.data.sessionId) {
    const { data: session } = await admin
      .from('lab_sessions')
      .select('id, started_at')
      .eq('id', parsed.data.sessionId)
      .eq('student_id', user.id)
      .eq('lab_id', lab.id)
      .maybeSingle();
    if (session) {
      const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
      const { error } = await admin
        .from('lab_sessions')
        .update({
          params,
          duration_s: Math.max(0, Math.min(parsed.data.durationS, elapsed, 86_400)),
          ...(attemptId ? { attempt_id: attemptId } : {}),
        })
        .eq('id', session.id);
      return error ? { ok: false } : { ok: true, sessionId: session.id };
    }
  }
  const { data, error } = await admin
    .from('lab_sessions')
    .insert({ student_id: user.id, lab_id: lab.id, params, attempt_id: attemptId })
    .select('id')
    .single();
  return error || !data ? { ok: false } : { ok: true, sessionId: data.id };
}

function localeOf(form: FormData): Locale {
  const v = form.get('locale');
  return typeof v === 'string' && isLocale(v) ? v : 'ru';
}

/** Starts a new round of lab questions (after the previous one is finished). */
export async function startLabQuestions(form: FormData): Promise<void> {
  const locale = localeOf(form);
  const code = String(form.get('code') ?? '');
  const back = `/${locale}/labs/${encodeURIComponent(code)}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(back)}`);
  const lab = await getLab(code, locale);
  if (!lab || lab.status !== 'published' || user.role !== 'student') redirect(back);
  const access = await labAccess(lab, user);
  const { usable } = usableQuestions(lab, access.hasPass);
  if (!access.student || !usable.length) redirect(back);
  if (!(await openLabAttemptId(user.id, lab.id))) {
    const { error } = await createAdminClient()
      .from('attempts')
      .insert({ student_id: user.id, kind: 'lab', lab_id: lab.id, max_score: usable.length });
    if (error) throw new Error(`lab attempt failed: ${error.message}`);
  }
  // Same page: re-render it in place (a redirect to the same URL with a hash would not refetch).
  revalidatePath('/[locale]/labs/[code]', 'page');
}
