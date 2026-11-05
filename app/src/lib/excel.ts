// Xuất/nhập Excel (nạp thư viện khi cần để ứng dụng khởi động nhanh)
export type Cot = { tieuDe: string; khoa: string; rong?: number; dinhDang?: 'tien' | 'so' }
type Bang = { ten: string; cot: Cot[]; dong: Record<string, unknown>[]; tongDong?: Record<string, unknown> }

export async function xuatExcel(tenTep: string, tieuDe: string, bang: Bang[]) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  for (const b of bang) {
    const ws = wb.addWorksheet(b.ten.slice(0, 31))
    ws.addRow([tieuDe]).font = { bold: true, size: 14 }
    ws.addRow([`Xuất ngày ${new Date().toLocaleDateString('vi-VN')}`])
    ws.addRow([])
    const h = ws.addRow(b.cot.map((c) => c.tieuDe))
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    h.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D63' } }; c.alignment = { wrapText: true, vertical: 'middle' } })
    for (const d of b.dong) ws.addRow(b.cot.map((c) => d[c.khoa] ?? ''))
    if (b.tongDong) { const t = ws.addRow(b.cot.map((c) => b.tongDong![c.khoa] ?? '')); t.font = { bold: true } }
    b.cot.forEach((c, i) => {
      const col = ws.getColumn(i + 1); col.width = c.rong ?? 16
      if (c.dinhDang === 'tien') col.numFmt = '#,##0'
      if (c.dinhDang === 'so') col.numFmt = '#,##0.###'
    })
    ws.views = [{ state: 'frozen', ySplit: 4 }]
  }
  const buf = await wb.xlsx.writeBuffer()
  taiVe(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), tenTep.endsWith('.xlsx') ? tenTep : tenTep + '.xlsx')
}

export function taiVe(blob: Blob, ten: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ten
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/** Đọc bảng vật tư mẫu: cột A tên, B đơn vị, C khối lượng, D đơn giá (dòng có chữ "Tên…" là tiêu đề) */
export async function docVatTuExcel(f: File) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await f.arrayBuffer())
  const ws = wb.worksheets[0]; const kq: { ten: string; dvt: string; khoi_luong_dt: number; don_gia_dt: number; dong: number }[] = []
  const txt = (v: unknown) => String((v as { text?: string; result?: unknown })?.text ?? (v as { result?: unknown })?.result ?? v ?? '').trim()
  const num = (v: unknown) => { const x = (v as { result?: unknown })?.result ?? v; const n = typeof x === 'number' ? x : Number(String(x ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN }
  let batDau = 1
  ws.eachRow((r, i) => { if (batDau === 1 && txt(r.getCell(1).value).toLowerCase().startsWith('tên')) batDau = i })
  ws.eachRow((r, i) => {
    if (i <= batDau) return
    const ten = txt(r.getCell(1).value); if (!ten) return
    kq.push({ ten, dvt: txt(r.getCell(2).value), khoi_luong_dt: num(r.getCell(3).value), don_gia_dt: num(r.getCell(4).value), dong: i })
  })
  return kq
}
export async function mauVatTu() {
  await xuatExcel('mau-vat-tu', 'Mẫu nhập vật tư theo dự toán (xóa dòng ví dụ trước khi nhập)', [{
    ten: 'Vật tư', cot: [{ tieuDe: 'Tên vật tư', khoa: 'a', rong: 30 }, { tieuDe: 'Đơn vị tính', khoa: 'b' }, { tieuDe: 'Khối lượng dự toán', khoa: 'c' }, { tieuDe: 'Đơn giá dự toán', khoa: 'd' }],
    dong: [{ a: 'Xi măng PC40', b: 'tấn', c: 100, d: 1500000 }],
  }])
}

/** Danh mục vật tư mẫu dùng chung: cột A tên, B đơn vị, C đơn giá tham khảo (dòng có chữ "Tên…" là tiêu đề) */
export async function docDanhMucExcel(f: File) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await f.arrayBuffer())
  const ws = wb.worksheets[0]; const kq: { ten: string; dvt: string; don_gia: number; dong: number }[] = []
  const txt = (v: unknown) => String((v as { text?: string; result?: unknown })?.text ?? (v as { result?: unknown })?.result ?? v ?? '').trim()
  const num = (v: unknown) => { const x = (v as { result?: unknown })?.result ?? v; if (x === null || x === undefined || x === '') return 0; const n = typeof x === 'number' ? x : Number(String(x).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN }
  let batDau = 1
  ws.eachRow((r, i) => { if (batDau === 1 && txt(r.getCell(1).value).toLowerCase().startsWith('tên')) batDau = i })
  ws.eachRow((r, i) => {
    if (i <= batDau) return
    const ten = txt(r.getCell(1).value); if (!ten) return
    kq.push({ ten, dvt: txt(r.getCell(2).value), don_gia: num(r.getCell(3).value), dong: i })
  })
  return kq
}
export async function mauDanhMuc() {
  await xuatExcel('mau-danh-muc-vat-tu', 'Mẫu danh mục vật tư (xóa dòng ví dụ trước khi nhập)', [{
    ten: 'Danh mục', cot: [{ tieuDe: 'Tên vật tư', khoa: 'a', rong: 32 }, { tieuDe: 'Đơn vị tính', khoa: 'b' }, { tieuDe: 'Đơn giá tham khảo', khoa: 'c' }],
    dong: [{ a: 'Xi măng PC40', b: 'tấn', c: 1500000 }],
  }])
}
