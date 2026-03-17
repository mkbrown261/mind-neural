import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './' }))

// API route for OpenAI key config (if needed)
app.get('/api/health', (c) => {
  return c.json({ status: 'alive', mind: 'active' })
})

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
  <script type="module" src="/static/app.js"></script>
</head>
<body>
  <div id="app"></div>
</body>
</html>`)
})

export default app
