<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- AI calls go through src/lib/ai/gateway.server.ts (Lovable AI Gateway, chat completions) and are only invoked from authenticated server functions — keeps keys and prompts server-side.
- AI results persist in public.studio_results scoped by user_id RLS — one table for all studio outputs keeps history simple.
- Signed-in pages live under src/routes/_authenticated/ (client-side session gate, ssr:false) — session lives in browser storage.
- The rare-disease graph is a bundled, audited read-only dataset; questions send only a bounded two-hop subgraph to Gemini — keeps answers traceable and token use predictable.
- Adaptive user settings live in public.profiles with per-user RLS — personal preferences remain private while the graph stays shared.
- Keep public-page character motion subtle and reduced-motion safe; use Ziva's dark positive artwork on light surfaces.
- Atlas uses one continuous Ziva-led chat with a bottom composer; the 3D graph is a complementary view, never a second question surface — keeps questions and answers together.
