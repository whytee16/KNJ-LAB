-- Stage 5q.1: register the ray optics labs (models: packages/physics/src/optics).
-- Texts and questions come as AI drafts through `pnpm content:import-drafts` and need review.
insert into public.labs (code, subject_code, kind, grade_from, default_params, is_free_demo, sort)
values
  ('reflection', 'physics', 'physics', 8, '{"alpha": 30, "phi": 0, "a": 20}', false, 110),
  ('refraction', 'physics', 'physics', 8, '{"pair": 0, "alpha": 40}', false, 120),
  ('thin-lens', 'physics', 'physics', 8, '{"kind": 0, "F": 10, "d": 25, "h": 3, "s": 20}', false, 130);
