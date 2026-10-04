CREATE TABLE public.studio_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('brand','review')),
  title text NOT NULL,
  input text NOT NULL DEFAULT '',
  output jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.studio_results TO authenticated;
GRANT ALL ON public.studio_results TO service_role;
ALTER TABLE public.studio_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.studio_results FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.studio_results FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON public.studio_results FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX studio_results_user_idx ON public.studio_results (user_id, created_at DESC);