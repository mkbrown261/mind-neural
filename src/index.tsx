import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { cors } from 'hono/cors'
import growthHtml from '../public/growth.html?raw'

// ─── Cloudflare bindings ──────────────────────────────────────────────────
type Bindings = {
  MIND_SYNC: KVNamespace   // KV namespace for cross-device sync
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './' }))

app.get('/api/health', (c) => {
  return c.json({ status: 'alive', mind: 'active', version: '9.20' })
})

// ═══════════════════════════════════════════════════════════════════════════
// MIND SYNC API  — effortless cross-device persistence
// ─────────────────────────────────────────────────────────────────────────
//
// Zero setup for the user. Flow:
//   1. MIND auto-generates a 6-char SYNC CODE on first init (stored in IDB)
//   2. Every interaction pushes a snapshot to KV under that code
//   3. On another device: open /growth, type the 6-char code → instant sync
//   4. No accounts. No Firebase. No URLs to copy. Just a short code.
//
// KV key structure:
//   sync:{CODE}:snapshot   → full growth snapshot (JSON, TTL 30d)
//   sync:{CODE}:identity   → identity/beliefs/profile (JSON, TTL 30d)
//   sync:{CODE}:timeline   → last 50 timeline events (JSON, TTL 30d)
//   sync:{CODE}:ping       → last-seen timestamp (TTL 7d)
//
// All TTLs auto-renew on each write — data lives as long as MIND is active.
// ═══════════════════════════════════════════════════════════════════════════

const SYNC_TTL_SECS = 30 * 24 * 60 * 60   // 30 days
const PING_TTL_SECS =  7 * 24 * 60 * 60   // 7 days
const CODE_RE       = /^[A-Z0-9]{4,8}$/   // valid sync code pattern

function syncKey(code: string, sub: string) {
  return `sync:${code.toUpperCase()}:${sub}`
}

function validCode(code: string | undefined): code is string {
  return !!code && CODE_RE.test(code.toUpperCase())
}

// ── Push snapshot (called after every interaction) ────────────────────────
// POST /api/sync/:code/snapshot   body: { snapshot, identity?, timeline? }
app.post('/api/sync/:code/snapshot', async (c) => {
  const code = c.req.param('code')
  if (!validCode(code)) return c.json({ error: 'Invalid sync code' }, 400)
  if (!c.env?.MIND_SYNC) return c.json({ ok: true, offline: true })   // KV not bound — silent pass

  try {
    const body = await c.req.json<{
      snapshot:  object
      identity?: object
      timeline?: object[]
    }>()

    const upper = code.toUpperCase()
    const now   = Date.now()

    // Always write snapshot
    await c.env.MIND_SYNC.put(
      syncKey(upper, 'snapshot'),
      JSON.stringify({ ...body.snapshot, _syncAt: now }),
      { expirationTtl: SYNC_TTL_SECS }
    )

    // Write identity if provided
    if (body.identity) {
      await c.env.MIND_SYNC.put(
        syncKey(upper, 'identity'),
        JSON.stringify({ ...body.identity, _syncAt: now }),
        { expirationTtl: SYNC_TTL_SECS }
      )
    }

    // Write timeline if provided (keep last 50)
    if (body.timeline && Array.isArray(body.timeline)) {
      const trimmed = body.timeline.slice(-50)
      await c.env.MIND_SYNC.put(
        syncKey(upper, 'timeline'),
        JSON.stringify(trimmed),
        { expirationTtl: SYNC_TTL_SECS }
      )
    }

    // Heartbeat ping
    await c.env.MIND_SYNC.put(
      syncKey(upper, 'ping'),
      String(now),
      { expirationTtl: PING_TTL_SECS }
    )

    return c.json({ ok: true, syncAt: now })
  } catch (err: any) {
    return c.json({ error: err?.message ?? 'Write failed' }, 500)
  }
})

// ── Pull latest state (called by receiving device) ────────────────────────
// GET /api/sync/:code   → { snapshot, identity, timeline, ping, syncAt }
app.get('/api/sync/:code', async (c) => {
  const code = c.req.param('code')
  if (!validCode(code)) return c.json({ error: 'Invalid sync code' }, 400)
  if (!c.env?.MIND_SYNC) return c.json({ found: false, offline: true })

  const upper = code.toUpperCase()

  try {
    const [snapRaw, identityRaw, timelineRaw, pingRaw] = await Promise.all([
      c.env.MIND_SYNC.get(syncKey(upper, 'snapshot')),
      c.env.MIND_SYNC.get(syncKey(upper, 'identity')),
      c.env.MIND_SYNC.get(syncKey(upper, 'timeline')),
      c.env.MIND_SYNC.get(syncKey(upper, 'ping')),
    ])

    if (!snapRaw) return c.json({ found: false })

    return c.json({
      found:    true,
      snapshot: JSON.parse(snapRaw),
      identity: identityRaw  ? JSON.parse(identityRaw)  : null,
      timeline: timelineRaw  ? JSON.parse(timelineRaw)  : [],
      ping:     pingRaw      ? Number(pingRaw)           : null,
    })
  } catch (err: any) {
    return c.json({ error: err?.message ?? 'Read failed' }, 500)
  }
})

// ── Poll for changes (lightweight — just returns _syncAt timestamp) ────────
// GET /api/sync/:code/ping  → { syncAt, ping }
app.get('/api/sync/:code/ping', async (c) => {
  const code = c.req.param('code')
  if (!validCode(code)) return c.json({ error: 'Invalid sync code' }, 400)
  if (!c.env?.MIND_SYNC) return c.json({ syncAt: 0, offline: true })

  const upper = code.toUpperCase()

  try {
    const [snapRaw, pingRaw] = await Promise.all([
      c.env.MIND_SYNC.get(syncKey(upper, 'snapshot')),
      c.env.MIND_SYNC.get(syncKey(upper, 'ping')),
    ])

    if (!snapRaw) return c.json({ found: false })

    const snap = JSON.parse(snapRaw) as { _syncAt?: number }
    return c.json({ found: true, syncAt: snap._syncAt ?? 0, ping: pingRaw ? Number(pingRaw) : 0 })
  } catch {
    return c.json({ syncAt: 0 })
  }
})

// ── Verify a code exists (before user enters it on another device) ─────────
// GET /api/sync/:code/exists  → { exists: bool }
// Checks BOTH snapshot AND ping keys so a freshly-initialised MIND
// (which pushes snapshot immediately) is found even before any conversation.
app.get('/api/sync/:code/exists', async (c) => {
  const code = c.req.param('code')
  if (!validCode(code)) return c.json({ exists: false })
  if (!c.env?.MIND_SYNC) return c.json({ exists: false, offline: true })

  const upper = code.toUpperCase()
  try {
    const [ping, snap] = await Promise.all([
      c.env.MIND_SYNC.get(syncKey(upper, 'ping')),
      c.env.MIND_SYNC.get(syncKey(upper, 'snapshot')),
    ])
    return c.json({ exists: !!(ping || snap) })
  } catch {
    return c.json({ exists: false })
  }
})

// Growth Interface — served from embedded raw HTML (Vite ?raw import)
app.get('/growth', (c) => c.html(growthHtml))

// Main app route — serves the SPA
app.get('*', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>MIND — Neural Interface</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/static/app.css">
  <style>
    :root{--bg:#020408;--bg2:#050810;--text-dim:#4a5068;--text-bright:#e8ecff;--accent:#4466ff;--accent2:#aa44ff;--mind-font:'Space Mono',monospace;}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body{width:100%;height:100%;overflow:hidden;background:var(--bg);color:var(--text-bright)}
    #app{width:100%;height:100%}
    #loading{position:fixed;inset:0;z-index:100;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;transition:opacity 0.8s ease}
    #loading.fade{opacity:0;pointer-events:none}
    #loading-logo{font-family:var(--mind-font);font-size:42px;font-weight:700;letter-spacing:0.4em;color:var(--text-bright);text-shadow:0 0 40px rgba(80,100,255,0.5)}
    #loading-sub{font-family:var(--mind-font);font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:var(--text-dim)}
    #loading-bar{width:200px;height:1px;background:rgba(255,255,255,0.05);border-radius:1px;overflow:hidden}
    #loading-bar-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));width:5%;transition:width 0.3s ease;box-shadow:0 0 8px rgba(80,100,255,0.6)}
  </style>
  <script type="module" src="/static/app.js"></script>
</head>
<body>
  <div id="app">
    <div id="loading">
      <div id="loading-logo">MIND</div>
      <div id="loading-sub">Neural Interface</div>
      <div id="loading-bar"><div id="loading-bar-fill"></div></div>
    </div>
  </div>
</body>
</html>`)
})

export default app
