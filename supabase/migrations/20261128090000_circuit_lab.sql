-- Stage 5b.4: register the DC circuit lab (model: packages/physics/src/circuit.ts).
-- Texts and questions come as AI drafts through `pnpm content:import-drafts` and need review.
insert into public.labs (code, subject_code, kind, grade_from, default_params, is_free_demo, sort)
values ('circuit', 'physics', 'physics', 8, '{"emf": 12, "r": 0, "R1": 10, "R2": 20, "mode": 0}', false, 60);
