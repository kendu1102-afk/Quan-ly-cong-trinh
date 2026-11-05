-- Kho ảnh/chứng từ (riêng tư). Đường dẫn tệp: <cong_trinh_id>/<loai>/<tên>
insert into storage.buckets (id, name, public, file_size_limit)
values ('chung-tu', 'chung-tu', false, 5242880)
on conflict (id) do nothing;

create policy "ct_doc" on storage.objects for select to authenticated
  using (bucket_id = 'chung-tu' and public.co_quyen(((storage.foldername(name))[1])::uuid));
create policy "ct_them" on storage.objects for insert to authenticated
  with check (bucket_id = 'chung-tu' and public.co_quyen(((storage.foldername(name))[1])::uuid));
create policy "ct_xoa" on storage.objects for delete to authenticated
  using (bucket_id = 'chung-tu' and public.is_admin());
