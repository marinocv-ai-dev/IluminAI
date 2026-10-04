import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Locally, `npm run dev` serves /api/* from the same files Vercel deploys as functions.
// ponytail: POST only; add methods if a function needs them
const devApi = (): Plugin => ({
  name: 'dev-api',
  configureServer(server) {
    Object.assign(process.env, loadEnv('development', process.cwd(), ''))
    server.middlewares.use('/api', async (req, res, next) => {
      if (req.method !== 'POST') return next()
      const chunks: Buffer[] = []
      for await (const c of req) chunks.push(c as Buffer)
      const mod = await server.ssrLoadModule(`/api${req.url!.split('?')[0]}.ts`)
      const out: Response = await mod.POST(new Request('http://dev' + req.originalUrl, {
        method: 'POST', headers: req.headers as any, body: Buffer.concat(chunks),
      }))
      res.statusCode = out.status
      res.setHeader('content-type', out.headers.get('content-type') ?? 'application/json')
      res.end(await out.text())
    })
  },
})

export default defineConfig({
  plugins: [react(), devApi()],
})
