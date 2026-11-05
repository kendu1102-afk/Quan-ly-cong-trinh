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
