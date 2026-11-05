import { supabase } from './supabase'
// Địa chỉ (slug) Edge Function trên Supabase. Trình soạn thảo web có thể tự đặt slug khác tên hàm (ví dụ "hyper-action").
export const HAM = (import.meta.env.VITE_HAM_QUAN_TRI as string | undefined) || 'hyper-action'

export async function goiHam<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(HAM, { body })
  if (error) {
    let m = error.message
    try { const j = await (error as unknown as { context: Response }).context.json(); if (j?.loi) m = j.loi } catch { /* giữ nguyên */ }
    throw new Error(m)
  }
  if (data?.loi) throw new Error(data.loi)
  return data as T
}
