CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  display_name text NOT NULL DEFAULT '',
  user_type text,
  preferred_language text,
  experience_level text NOT NULL DEFAULT 'guided',
  voice_enabled boolean NOT NULL DEFAULT true,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_user_type_check CHECK (user_type IS NULL OR user_type IN ('family', 'professional', 'organization')),
  CONSTRAINT profiles_language_check CHECK (preferred_language IS NULL OR preferred_language IN ('es', 'en')),
  CONSTRAINT profiles_experience_check CHECK (experience_level IN ('guided', 'professional'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());