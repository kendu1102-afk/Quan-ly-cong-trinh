// Cổng giả lập Supabase CHỈ DÙNG ĐỂ KIỂM THỬ: đăng nhập (JWT HS256), chuyển tiếp /rest/v1 sang PostgREST thật, kho tệp tạm trong bộ nhớ.
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const SECRET = 'test-secret-test-secret-test-secret-1234'
const PORT = Number(process.env.GW_PORT || 54321), PGR = Number(process.env.PGRST_PORT || 3000), PGPORT = process.env.PGPORT || '54399'
const DIST = process.env.DIST
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
const sign = (p) => { const h = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(p); return h + '.' + crypto.createHmac('sha256', SECRET).update(h).digest('base64url') }
const verify = (t) => { const [h, p, s] = t.split('.'); if (crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url') !== s) return null; return JSON.parse(Buffer.from(p, 'base64url')) }
const sql = (q) => execFileSync('psql', ['-h', '/tmp', '-p', PGPORT, '-U', 'postgres', '-d', 't', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim()
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
const files = new Map()
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }

function phien(u) {
  const now = Math.floor(Date.now() / 1000)
  const access = sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp: now + 3600, iat: now })
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r:' + u.id,
    user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }
}
const body = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))) })
const json = (res, code, o) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(o)) }

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  try {
    if (url.pathname === '/auth/v1/token') {
      const b = JSON.parse((await body(req)).toString() || '{}')
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const id = String(b.refresh_token || '').slice(2).replace(/[^0-9a-f-]/g, ''); const r = sql(`select id,email from auth.users where id='${id}'`)
        if (!r) return json(res, 400, { error: 'invalid_grant', error_description: 'bad refresh' })
        const [uid, email] = r.split('|'); return json(res, 200, phien({ id: uid, email }))
      }
      const email = String(b.email).replace(/'/g, ''), pw = crypto.createHash('sha256').update(String(b.password)).digest('hex')
      const r = sql(`select id,email from auth.users where email='${email}' and pw='${pw}'`)
      if (!r) return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' })
      const [uid, em] = r.split('|'); return json(res, 200, phien({ id: uid, email: em }))
    }
    if (url.pathname === '/auth/v1/user') {
      const p = verify((req.headers.authorization || '').slice(7)); if (!p) return json(res, 401, { msg: 'bad jwt' })
      return json(res, 200, { id: p.sub, aud: 'authenticated', role: 'authenticated', email: p.email, app_metadata: {}, user_metadata: {} })
    }
    if (url.pathname === '/auth/v1/logout') { res.writeHead(204, cors); return res.end() }
    if (url.pathname.startsWith('/rest/v1/')) {
      const data = await body(req)
      const h = { ...req.headers, host: `127.0.0.1:${PGR}` }; delete h.origin; delete h.referer
      const pr = http.request({ host: '127.0.0.1', port: PGR, path: url.pathname.slice(8) + url.search, method: req.method, headers: h }, (r) => { res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res) })
      pr.on('error', (e) => json(res, 502, { message: String(e) })); return pr.end(data)
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/')) { const k = decodeURIComponent(url.pathname.slice('/storage/v1/object/sign/'.length)); return json(res, 200, { signedURL: `/object/sign/${k}?token=t` }) }
    if (url.pathname.startsWith('/storage/v1/object/') && ['POST', 'PUT'].includes(req.method)) {
      const k = decodeURIComponent(url.pathname.slice('/storage/v1/object/'.length)); files.set(k, { b: await body(req), t: req.headers['content-type'] }); return json(res, 200, { Key: k })
    }
    if (url.pathname.startsWith('/storage/v1/object/') && req.method === 'DELETE') { const k = decodeURIComponent(url.pathname.slice('/storage/v1/object/'.length)); files.delete(k); return json(res, 200, []) }
    if (url.pathname === '/__files') return json(res, 200, [...files.keys()])
    let f = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname)
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
    res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res)
  } catch (e) { json(res, 500, { message: String(e) }) }
}).listen(PORT, () => console.log('gateway', PORT))
