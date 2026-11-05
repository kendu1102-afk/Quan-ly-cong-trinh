import { describe, expect, it } from 'vitest'
import { canhBao, conLai, docSo, thanhTien, vuot } from './tinh'
describe('công thức', () => {
  it('thành tiền', () => { expect(thanhTien(40, 1500000)).toBe(60000000); expect(thanhTien(0.1, 3)).toBe(0.3) })
  it('còn lại / vượt', () => {
    expect(conLai(100, 60)).toBe(40); expect(vuot(100, 60)).toBe(0); expect(vuot(100, 110)).toBe(10); expect(conLai(100, 110)).toBe(-10)
  })
  it('cảnh báo', () => {
    expect(canhBao(100, 99)).toBe('ok'); expect(canhBao(100, 100)).toBe('dat'); expect(canhBao(100, 101)).toBe('vuot'); expect(canhBao(0, 0)).toBe('ok')
  })
  it('đọc số người dùng gõ', () => {
    expect(docSo('1.234,5')).toBe(1234.5); expect(docSo('1234.5')).toBe(1234.5); expect(docSo('1,5')).toBe(1.5)
    expect(docSo('1.500.000')).toBe(1500000); expect(docSo('')).toBeNaN()
  })
})

import { soNgayConLai } from './tinh'
describe('đếm ngược ngày hết hợp đồng', () => {
  it('hôm nay / ngày mai / hôm qua', () => {
    expect(soNgayConLai('2026-11-05', '2026-11-05')).toBe(0); expect(soNgayConLai('2026-11-06', '2026-11-05')).toBe(1); expect(soNgayConLai('2026-11-04', '2026-11-05')).toBe(-1)
  })
  it('đúng 10 ngày, qua tháng và qua năm', () => {
    expect(soNgayConLai('2026-11-15', '2026-11-05')).toBe(10); expect(soNgayConLai('2026-11-25', '2026-11-20')).toBe(5)
    expect(soNgayConLai('2027-01-03', '2026-12-28')).toBe(6); expect(soNgayConLai('2026-12-31', '2026-01-01')).toBe(364)
  })
  it('năm nhuận và đổi giờ không làm lệch ngày', () => {
    expect(soNgayConLai('2028-03-01', '2028-02-27')).toBe(3); expect(soNgayConLai('2027-03-01', '2027-02-27')).toBe(2); expect(soNgayConLai('2026-03-30', '2026-03-28')).toBe(2)
  })
  it('chấp nhận chuỗi ngày có phần giờ', () => { expect(soNgayConLai('2026-11-15T00:00:00', '2026-11-05')).toBe(10) })
})
