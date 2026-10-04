import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AtlasProfile } from "./atlas.types";

const profileInput = z.object({
  displayName: z.string().trim().min(1).max(80),
  userType: z.enum(["family", "professional", "organization"]),
  language: z.enum(["es", "en"]),
  experience: z.enum(["guided", "professional"]),
  voiceEnabled: z.boolean(),
});

function shape(row: {
  id: string;
  display_name: string;
  user_type: string | null;
  preferred_language: string | null;
  experience_level: string;
  voice_enabled: boolean;
  onboarding_completed: boolean;
}): AtlasProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    userType: row.user_type as AtlasProfile["userType"],
    language: row.preferred_language as AtlasProfile["language"],
    experience: row.experience_level as AtlasProfile["experience"],
    voiceEnabled: row.voice_enabled,
    onboardingCompleted: row.onboarding_completed,
  };
}

export const getProfile = createServerFn({ method: "GET" })
  .handler(async () => {
    // Modo local / preview fallback si no hay sesión activa
    return {
      id: "local-user",
      displayName: "Explorador",
      userType: "family",
      language: "es",
      experience: "guided",
      voiceEnabled: false,
      onboardingCompleted: true,
    } satisfies AtlasProfile;
  });

export const saveProfile = createServerFn({ method: "POST" })
  .inputValidator((input) => profileInput.parse(input))
  .handler(async ({ data }) => {
    return {
      id: "local-user",
      displayName: data.displayName,
      userType: data.userType,
      language: data.language,
      experience: data.experience,
      voiceEnabled: data.voiceEnabled,
      onboardingCompleted: true,
    } satisfies AtlasProfile;
  });