import { defineConfig, loadEnv, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { askAgnes } from './agnes-proxy/agnes.mjs'

function readJsonBody(req: Connect.IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 20_000) reject(new Error('Request body is too large.'))
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON body.'))
      }
    })
    req.on('error', reject)
  })
}

function localAgnesApi(mode: string) {
  const env = loadEnv(mode, process.cwd(), '')

  function installMiddleware(server: { middlewares: Connect.Server }) {
    server.middlewares.use('/api/chat', async (req, res) => {
      res.setHeader('Content-Type', 'application/json')
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end(JSON.stringify({ error: 'Method not allowed.' }))
        return
      }

      try {
        const payload = await readJsonBody(req)
        const result = await askAgnes(payload, env.AGNES_API_KEY, env.AGNES_MODEL)
        res.statusCode = result.status
        res.end(JSON.stringify(result.body))
      } catch (error) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid request.' }))
      }
    })
  }

  return {
    name: 'local-agnes-api',
    configureServer: installMiddleware,
    configurePreviewServer: installMiddleware,
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), localAgnesApi(mode)],
  assetsInclude: ['**/*.glb'],
}))
