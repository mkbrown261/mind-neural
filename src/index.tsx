import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { cors } from 'hono/cors'
import growthHtml from '../public/growth.html?raw'

const app = new Hono()

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './' }))

app.get('/api/health', (c) => {
  return c.json({ status: 'alive', mind: 'active' })
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
