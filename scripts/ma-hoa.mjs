// Mã hóa tệp sao lưu (tương thích với app/src/lib/mahoa.ts để giải mã ngay trong phần mềm)
import crypto from 'node:crypto'
export const SO_VONG = 200000
export function maHoa(vanBan, matKhau) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12)
  const khoa = crypto.pbkdf2Sync(matKhau, salt, SO_VONG, 32, 'sha256')
  const c = crypto.createCipheriv('aes-256-gcm', khoa, iv)
  const ct = Buffer.concat([c.update(vanBan, 'utf8'), c.final()])
  return { dinh_dang: 'qlct-sao-luu-ma-hoa', v: 1, lap: SO_VONG, salt: salt.toString('base64'), iv: iv.toString('base64'), du_lieu: Buffer.concat([ct, c.getAuthTag()]).toString('base64') }
}
