/** Nén ảnh về cạnh dài tối đa 1600px, JPEG ~0.7 (≈200–300 KB) để tiết kiệm kho 1 GB miễn phí. PDF giữ nguyên. */
export async function nenTep(f: File): Promise<Blob> {
  if (!f.type.startsWith('image/')) {
    if (f.size > 5 * 1024 * 1024) throw new Error('Tệp lớn hơn 5 MB')
    return f
  }
  const bmp = await createImageBitmap(f)
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('Không nén được ảnh'))), 'image/jpeg', 0.7))
}
