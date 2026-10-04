# Deploy to Vercel

## 1. Push to GitHub
Create a repository and push the contents of this folder. Before pushing, check that the `.gitignore` excludes `.env.local`, `node_modules`, `dist` and `data/.cache`, and that `git status` does **not** list any `.env` file.

## 2. Import in Vercel
1. Vercel → **Add New → Project** → import the repository.
2. **Root Directory:** `atlas`
3. **Framework preset:** Vite (auto-detected). Build command `npm run build`, output `dist`.
4. **Environment Variables** (Settings → Environment Variables, for Production and Preview):

| Name | Value |
|---|---|
| `LLM_BASE_URL` | `https://api.openai.com/v1` |
| `LLM_MODEL` | `gpt-5.4-mini` |
| `LLM_KEY` | the team's OpenAI API key (ask Marino; never commit it) |
| `LLM_EXTRA` | `{"reasoning_effort":"low"}` |
| `BRIGHT_DATA_API_TOKEN` | optional: only needed to re-run the research agent, not for the web app |

5. **Deploy.** `atlas/api/ask.ts` becomes the serverless function `/api/ask`.

## 3. Smoke test after deploy
```bash
curl -s -X POST https://<your-app>.vercel.app/api/ask \
  -H 'content-type: application/json' \
  -d '{"question":"x","context":"N A|gene|X|","role":"hacker"}'
# expected: HTTP 400 {"error":"invalid role ..."}  → the function is live
```
Then, in the browser:
- **▶ Watch demo** plays without the LLM.
- One suggested question gets a real answer and lights up the graph.
- **Run agent: DEE69** replays the research agent.
- **Review queue (43)** opens the review panel.
- **ES** switches the interface to Spanish.

If the question returns an error, check the four `LLM_*` variables and redeploy, since environment changes need a new deployment.
