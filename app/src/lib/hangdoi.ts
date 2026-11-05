// Hàng đợi nhập liệu khi mất mạng: lưu trong IndexedDB trên máy, tự gửi lên khi có Internet.
// client_id/id do máy tạo => gửi lại nhiều lần vẫn không bị trùng.
import { get, set } from 'idb-keyval'
import { supabase } from './supabase'

export type TepCho = { name: string; blob: Blob }
export type MucHangDoi = {
  id: string; uid: string; loai: 'vat_tu' | 'chi_phi'; congTrinhId: string
  hang: Record<string, unknown>; teps: TepCho[]; loi?: string
}
const KEY = 'hang-doi-v1'
export const SU_KIEN = 'hangdoi-doi'

export const layHangDoi = async (): Promise<MucHangDoi[]> => (await get(KEY)) ?? []
const luu = async (a: MucHangDoi[]) => { await set(KEY, a); window.dispatchEvent(new Event(SU_KIEN)) }
export async function themHangDoi(m: MucHangDoi) { await luu([...(await layHangDoi()), m]) }
export async function boMuc(id: string) { await luu((await layHangDoi()).filter((x) => x.id !== id)) }
const bang = (l: MucHangDoi['loai']) => (l === 'vat_tu' ? 'phieu_nhap_vt' : 'chi_phi')
const dang = (n: string) => (n.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')

export async function guiTep(
  uid: string, loai: MucHangDoi['loai'], congTrinhId: string, banGhiId: string, teps: TepCho[], batDau = 0,
) {
  for (let i = 0; i < teps.length; i++) {
    const t = teps[i]
    const path = `${congTrinhId}/${loai}/${banGhiId}/${batDau + i}.${dang(t.name)}`
    const up = await supabase.storage.from('chung-tu').upload(path, t.blob, { upsert: true, contentType: t.blob.type || undefined })
    if (up.error) throw up.error
    const { error } = await supabase.from('tep_dinh_kem').upsert(
      { cong_trinh_id: congTrinhId, loai, ban_ghi_id: banGhiId, duong_dan: path, ten_tep: t.name, created_by: uid },
      { onConflict: 'duong_dan', ignoreDuplicates: true },
    )
    if (error) throw error
  }
}

/** Gửi 1 bản ghi (+ tệp). Ném lỗi có `.code` nếu máy chủ từ chối; lỗi không có code = mất mạng. */
export async function guiMuc(m: MucHangDoi) {
  const { error } = await supabase.from(bang(m.loai)).upsert(m.hang, { onConflict: 'client_id', ignoreDuplicates: true })
  if (error) throw error
  await guiTep(m.uid, m.loai, m.congTrinhId, m.hang.id as string, m.teps)
}

let dangChay = false
export async function dongBo(uidHienTai: string): Promise<{ daGui: number; con: number }> {
  if (dangChay) return { daGui: 0, con: (await layHangDoi()).length }
  dangChay = true
  let daGui = 0
  try {
    for (const m of await layHangDoi()) {
      if (m.uid !== uidHienTai) continue
      try { await guiMuc(m); await boMuc(m.id); daGui++ }
      catch (e) {
        const code = (e as { code?: string; statusCode?: string }).code
        if (code || (e as { statusCode?: string }).statusCode) {
          const ds = await layHangDoi()
          await luu(ds.map((x) => (x.id === m.id ? { ...x, loi: (e as Error).message } : x)))
          continue // bị từ chối: giữ lại để người dùng xem/xóa, tiếp tục mục khác
        }
        break // mất mạng: dừng, thử lại sau
      }
    }
  } finally { dangChay = false }
  if (daGui) window.dispatchEvent(new Event('du-lieu-doi'))
  return { daGui, con: (await layHangDoi()).length }
}
