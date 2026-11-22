import 'server-only';
import { FREE_DIFFICULTY } from '@knj/task-engine';
import type { CurrentUser } from '@/server/authz';
import { activePass } from '@/server/entitlements';
import type { LabPageData } from './queries';

const STAFF = ['content_manager', 'reviewer', 'admin'];

export interface LabAccess {
  /** The simulation can be used. */
  open: boolean;
  /** The user can answer questions and their parameters are saved. */
  student: boolean;
  hasPass: boolean;
}

/**
 * Free-demo labs work for everyone; other labs need a student with an active pass
 * (staff may preview). Questions and saving are for students only.
 */
export async function labAccess(
  lab: Pick<LabPageData, 'isFreeDemo'>,
  user: CurrentUser | null,
): Promise<LabAccess> {
  const student = user?.role === 'student';
  const hasPass = student ? (await activePass(user.id)) !== null : false;
  const staff = user ? STAFF.includes(user.role) : false;
  return {
    open: lab.isFreeDemo || hasPass || staff,
    student: student && (lab.isFreeDemo || hasPass),
    hasPass,
  };
}

/** Lab questions the student may get: all with a pass, the free level otherwise. */
export function usableQuestions(lab: Pick<LabPageData, 'questions'>, hasPass: boolean) {
  const usable = lab.questions.filter((q) => hasPass || q.difficulty === FREE_DIFFICULTY);
  return { usable, locked: lab.questions.length - usable.length };
}
