-- Stage 5b.2: register the inclined plane lab (model: packages/physics/src/inclined-plane.ts).
-- Texts and questions come as AI drafts through `pnpm content:import-drafts` and need review.
insert into public.labs (code, subject_code, kind, grade_from, default_params, is_free_demo, sort)
values ('inclined-plane', 'physics', 'physics', 9, '{"angle": 30, "m": 2, "mu": 0.2, "L": 4, "g": 9.8}', false, 30);
