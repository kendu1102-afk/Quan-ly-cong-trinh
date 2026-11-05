import { useEffect, useState } from 'react'
import { batPush, guiThuPush, tatPush, trangThaiPush, type TrangThaiPush } from '../lib/push'
import { thongBao } from '../lib/thongbao'
import { Loi, Modal, Nut } from './ui'

const MO_TA: Record<TrangThaiPush, string> = {
  'da-bat': '✅ Điện thoại/máy này ĐANG nhận cảnh báo vật tư đạt hoặc vượt dự toán, kể cả khi đã đóng ứng dụng.',
  'chua-bat': 'Chưa bật. Bật để nhận cảnh báo ngay cả khi không mở ứng dụng.',
  'bi-chan': '⛔ Trình duyệt đang CHẶN thông báo của trang này. Hãy mở cài đặt trình duyệt (biểu tượng ổ khóa cạnh địa chỉ) → Thông báo → Cho phép, rồi quay lại đây.',
  'can-cai-ung-dung': 'Trên iPhone, hãy cài ứng dụng ra màn hình chính trước (Chia sẻ → Thêm vào MH chính), mở ứng dụng từ biểu tượng đó rồi bật thông báo. Cần iOS 16.4 trở lên.',
  'khong-ho-tro': 'Trình duyệt này không hỗ trợ thông báo đẩy. Trên Android hãy dùng Chrome.',
}

export default function ThongBaoDay({ dong }: { dong: () => void }) {
  const [tt, setTt] = useState<TrangThaiPush | null>(null); const [ban, setBan] = useState(false); const [loi, setLoi] = useState('')
  const lam = async (f: () => Promise<unknown>, ok?: string) => {
    setBan(true); setLoi('')
    try { await f(); if (ok) thongBao(ok) } catch (e) { setLoi((e as Error).message) }
    setTt(await trangThaiPush()); setBan(false)
  }
  useEffect(() => { trangThaiPush().then(setTt) }, [])
  return (
    <Modal tieuDe="🔔 Thông báo đẩy cảnh báo vật tư" dong={dong}>
      <div className="space-y-3">
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
          Khi một vật tư <b>đạt hoặc vượt khối lượng dự toán</b> (do bất kỳ ai nhập), máy chủ tự gửi thông báo tới Admin và các kế toán được cấp quyền công trình đó. Mỗi điện thoại cần bật riêng một lần.
        </p>
        <p className="font-semibold">{tt ? MO_TA[tt] : 'Đang kiểm tra…'}</p>
        <Loi t={loi} />
        {tt === 'chua-bat' && <Nut mau="vang" className="w-full" disabled={ban} onClick={() => lam(batPush, 'Đã bật thông báo đẩy trên thiết bị này')}>{ban ? 'Đang bật…' : 'Bật thông báo đẩy'}</Nut>}
        {tt === 'da-bat' && <>
          <Nut className="w-full" disabled={ban} onClick={() => lam(async () => {
            const r = await guiThuPush()
            if (!r.thiet_bi) throw new Error('Chưa có thiết bị nào đăng ký. Hãy tắt rồi bật lại.')
            if (!r.da_gui) throw new Error('Máy chủ không gửi được thông báo thử. Xem lại hướng dẫn cài đặt.')
            thongBao(`Đã gửi thử tới ${r.da_gui} thiết bị — xem thanh thông báo của máy`)
          })}>Gửi thông báo thử</Nut>
          <Nut mau="xam" className="w-full" disabled={ban} onClick={() => lam(tatPush, 'Đã tắt thông báo đẩy trên thiết bị này')}>Tắt thông báo trên thiết bị này</Nut>
        </>}
      </div>
    </Modal>
  )
}
