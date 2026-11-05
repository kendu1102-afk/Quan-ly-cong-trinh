// Giải mã tệp sao lưu đã mã hóa (do lịch GitHub tạo). AES-256-GCM, khóa dẫn xuất từ mật khẩu bằng PBKDF2-SHA256 (200.000 vòng).
export type TepMaHoa = { dinh_dang: 'qlct-sao-luu-ma-hoa'; v: 1; lap: number; salt: string; iv: string; du_lieu: string }
export const laTepMaHoa = (j: unknown): j is TepMaHoa => !!j && typeof j === 'object' && (j as { dinh_dang?: string }).dinh_dang === 'qlct-sao-luu-ma-hoa'
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export async function giaiMa(t: TepMaHoa, matKhau: string): Promise<unknown> {
  const goc = await crypto.subtle.importKey('raw', new TextEncoder().encode(matKhau), 'PBKDF2', false, ['deriveKey'])
  const khoa = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(t.salt), iterations: t.lap, hash: 'SHA-256' }, goc, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
  try {
    const ro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(t.iv) }, khoa, b64(t.du_lieu))
    return JSON.parse(new TextDecoder().decode(ro))
  } catch { throw new Error('Sai mật khẩu giải mã hoặc tệp bị hỏng') }
}
