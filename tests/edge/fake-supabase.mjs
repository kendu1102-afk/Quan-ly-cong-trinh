// CSDL và đăng nhập giả trong bộ nhớ, chỉ đủ dùng để chạy mã Edge Function khi kiểm thử
export const db = {}
export const nguoiDung = {}          // token -> { id }
export const goiTaoUser = []
class Q {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.one = null }
  select() { return this }
  eq(c, v) { this.f.push((r) => r[c] === v); return this }
  in(c, a) { this.f.push((r) => a.includes(r[c])); return this }
  maybeSingle() { this.one = 'maybe'; return this }
  single() { this.one = 'one'; return this }
  upsert(rows, o = {}) { this.op = 'upsert'; this.rows = [].concat(rows); this.o = o; return this }
  update(v) { this.op = 'update'; this.v = v; return this }
  delete() { this.op = 'delete'; return this }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej) }
  run() {
    const T = (db[this.t] ??= [])
    const m = (r) => this.f.every((f) => f(r))
    if (this.op === 'upsert') {
      for (const r of this.rows) { const k = this.o.onConflict; const i = k ? T.findIndex((x) => x[k] === r[k]) : -1; if (i < 0) T.push({ ...r }); else if (!this.o.ignoreDuplicates) T[i] = { ...T[i], ...r } }
      return { data: null, error: null }
    }
    if (this.op === 'update') { T.filter(m).forEach((r) => Object.assign(r, this.v)); return { data: null, error: null } }
    if (this.op === 'delete') { db[this.t] = T.filter((r) => !m(r)); return { data: null, error: null } }
    const rows = T.filter(m)
    if (this.one) return { data: rows[0] ?? null, error: rows[0] || this.one === 'maybe' ? null : { message: 'không có dòng' } }
    return { data: rows, error: null }
  }
}
export const createClient = () => ({
  from: (t) => new Q(t),
  auth: {
    getUser: async (tok) => (nguoiDung[tok] ? { data: { user: { id: nguoiDung[tok].id } } } : { data: { user: null } }),
    admin: {
      createUser: async (o) => { goiTaoUser.push(o); return { data: { user: { id: 'moi-1' } }, error: null } },
      updateUserById: async (id, o) => ({ error: null }),
    },
  },
})
