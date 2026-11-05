import { describe, expect, it } from 'vitest'
// @ts-expect-error tệp .mjs ở thư mục scripts (không có kiểu)
import { maHoa } from '../../../scripts/ma-hoa.mjs'
import { giaiMa, laTepMaHoa } from './mahoa'

describe('mã hóa sao lưu: script GitHub mã hóa, phần mềm giải mã', () => {
  const du = JSON.stringify({ phien_ban: 1, cong_trinh: [{ ten: 'Cầu A – Đường tỉnh 201' }], so: 1234567.89 })
  it('giải mã đúng với mật khẩu đúng', async () => {
    const t = maHoa(du, 'mat-khau-manh-123')
    expect(laTepMaHoa(t)).toBe(true)
    expect(await giaiMa(t, 'mat-khau-manh-123')).toEqual(JSON.parse(du))
  })
  it('sai mật khẩu thì báo lỗi, không lộ dữ liệu', async () => {
    await expect(giaiMa(maHoa(du, 'mat-khau-manh-123'), 'sai-mat-khau-khac')).rejects.toThrow('Sai mật khẩu')
  })
  it('tệp bị sửa thì bị phát hiện', async () => {
    const t = maHoa(du, 'mat-khau-manh-123'); const b = Uint8Array.from(atob(t.du_lieu), (c) => c.charCodeAt(0)); b[3] ^= 1; t.du_lieu = btoa(String.fromCharCode(...b))
    await expect(giaiMa(t, 'mat-khau-manh-123')).rejects.toThrow()
  })
  it('hai lần mã hóa cùng dữ liệu cho kết quả khác nhau (salt/iv ngẫu nhiên)', () => {
    expect(maHoa(du, 'abc-abc-abc-abc').du_lieu).not.toBe(maHoa(du, 'abc-abc-abc-abc').du_lieu)
  })
  it('tệp thường không bị nhận nhầm là tệp mã hóa', () => { expect(laTepMaHoa({ phien_ban: 1 })).toBe(false) })
})
