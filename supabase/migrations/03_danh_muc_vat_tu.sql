-- =====================================================================
-- Bổ sung 03: DANH MỤC VẬT TƯ MẪU DÙNG CHUNG cho mọi công trình
-- (chạy trong Supabase > SQL Editor SAU 01 và 02; chạy lại nhiều lần không hỏng dữ liệu)
-- =====================================================================
create table if not exists public.danh_muc_vat_tu (
  id uuid primary key default gen_random_uuid(),
  ten text not null unique check (length(trim(ten)) > 0),
  dvt text not null check (length(trim(dvt)) > 0),
  don_gia numeric(18,2) not null default 0 check (don_gia >= 0),   -- đơn giá tham khảo
  ghi_chu text not null default '',
  created_by uuid, created_at timestamptz not null default now(),
  updated_by uuid, updated_at timestamptz,
  version int not null default 1
);

-- Hàm dấu vết: chỉ ép công trình cố định ở các bảng có cột cong_trinh_id (bảng danh mục không có)
create or replace function public.dat_dau_vet() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_setting('app.phuc_hoi', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    new.version := 1;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if tg_table_name in ('vat_tu_mau','phieu_nhap_vt','chi_phi') then new.cong_trinh_id := old.cong_trinh_id; end if;
    if tg_table_name in ('phieu_nhap_vt','chi_phi') then new.client_id := old.client_id; end if;
    new.updated_by := auth.uid();
    new.updated_at := now();
    new.version := old.version + 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_dau_vet on public.danh_muc_vat_tu;
create trigger trg_dau_vet before insert or update on public.danh_muc_vat_tu for each row execute function public.dat_dau_vet();
drop trigger if exists trg_nhat_ky on public.danh_muc_vat_tu;
create trigger trg_nhat_ky after insert or update or delete on public.danh_muc_vat_tu for each row execute function public.ghi_nhat_ky();

alter table public.danh_muc_vat_tu enable row level security;
revoke all on public.danh_muc_vat_tu from anon, authenticated;
grant select, insert, update, delete on public.danh_muc_vat_tu to authenticated;
drop policy if exists p_dm_sel on public.danh_muc_vat_tu;
drop policy if exists p_dm_ins on public.danh_muc_vat_tu;
drop policy if exists p_dm_upd on public.danh_muc_vat_tu;
drop policy if exists p_dm_del on public.danh_muc_vat_tu;
create policy p_dm_sel on public.danh_muc_vat_tu for select using (public.is_active());   -- ai đăng nhập cũng xem được
create policy p_dm_ins on public.danh_muc_vat_tu for insert with check (public.is_admin());  -- chỉ Admin sửa
create policy p_dm_upd on public.danh_muc_vat_tu for update using (public.is_admin()) with check (public.is_admin());
create policy p_dm_del on public.danh_muc_vat_tu for delete using (public.is_admin());

-- Sao lưu / phục hồi: thêm danh mục vào (thay thế hàm cũ)
create or replace function public.xuat_sao_luu() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'Chỉ Admin được sao lưu';
  end if;
  return jsonb_build_object(
    'phien_ban', 1, 'thoi_gian', now(),
    'profiles',      (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from profiles x),
    'cong_trinh',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from cong_trinh x),
    'phan_quyen',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from phan_quyen x),
    'vat_tu_mau',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from vat_tu_mau x),
    'phieu_nhap_vt', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from phieu_nhap_vt x),
    'chi_phi',       (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from chi_phi x),
    'tep_dinh_kem',  (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from tep_dinh_kem x),
    'danh_muc_vat_tu', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from danh_muc_vat_tu x));
end $$;

create or replace function public.phuc_hoi_sao_luu(data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_ct int; n_vt int; n_pn int; n_cp int; n_pq int; n_tep int; n_dm int;
begin
  if not public.is_admin() then raise exception 'Chỉ Admin được phục hồi'; end if;
  if coalesce((data->>'phien_ban')::int, 0) <> 1 then raise exception 'Tệp sao lưu không hợp lệ'; end if;
  perform set_config('app.phuc_hoi', 'on', true);

  insert into cong_trinh (id, ten, chu_dau_tu, dia_diem, gia_tri_hop_dong, ngay_khoi_cong, ngay_hoan_thanh_dk,
                          nam, ghi_chu, trang_thai, luu_tru, created_by, created_at, updated_by, updated_at, version)
  select x.id, x.ten, x.chu_dau_tu, x.dia_diem, x.gia_tri_hop_dong, x.ngay_khoi_cong, x.ngay_hoan_thanh_dk,
         x.nam, x.ghi_chu, x.trang_thai, x.luu_tru, x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::cong_trinh, data->'cong_trinh') x
  on conflict (id) do update set ten=excluded.ten, chu_dau_tu=excluded.chu_dau_tu, dia_diem=excluded.dia_diem,
    gia_tri_hop_dong=excluded.gia_tri_hop_dong, ngay_khoi_cong=excluded.ngay_khoi_cong,
    ngay_hoan_thanh_dk=excluded.ngay_hoan_thanh_dk, nam=excluded.nam, ghi_chu=excluded.ghi_chu,
    trang_thai=excluded.trang_thai, luu_tru=excluded.luu_tru, version=greatest(cong_trinh.version, excluded.version)+1;
  get diagnostics n_ct = row_count;

  insert into vat_tu_mau (id, cong_trinh_id, ten, dvt, khoi_luong_dt, don_gia_dt, created_by, created_at, updated_by, updated_at, version)
  select x.id, x.cong_trinh_id, x.ten, x.dvt, x.khoi_luong_dt, x.don_gia_dt, x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::vat_tu_mau, data->'vat_tu_mau') x
  on conflict (id) do update set ten=excluded.ten, dvt=excluded.dvt, khoi_luong_dt=excluded.khoi_luong_dt,
    don_gia_dt=excluded.don_gia_dt, version=greatest(vat_tu_mau.version, excluded.version)+1;
  get diagnostics n_vt = row_count;

  insert into phieu_nhap_vt (id, client_id, cong_trinh_id, vat_tu_id, ngay, khoi_luong, don_gia, co_hoa_don, ghi_chu, da_xoa,
                             created_by, created_at, updated_by, updated_at, version)
  select x.id, x.client_id, x.cong_trinh_id, x.vat_tu_id, x.ngay, x.khoi_luong, x.don_gia, x.co_hoa_don, x.ghi_chu, x.da_xoa,
         x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::phieu_nhap_vt, data->'phieu_nhap_vt') x
  on conflict (id) do update set vat_tu_id=excluded.vat_tu_id, ngay=excluded.ngay, khoi_luong=excluded.khoi_luong,
    don_gia=excluded.don_gia, co_hoa_don=excluded.co_hoa_don, ghi_chu=excluded.ghi_chu, da_xoa=excluded.da_xoa,
    version=greatest(phieu_nhap_vt.version, excluded.version)+1;
  get diagnostics n_pn = row_count;

  insert into chi_phi (id, client_id, cong_trinh_id, ngay, ten_chi_phi, nhom, so_tien, chung_tu, chi_cho, ghi_chu, da_xoa,
                       created_by, created_at, updated_by, updated_at, version)
  select x.id, x.client_id, x.cong_trinh_id, x.ngay, x.ten_chi_phi, x.nhom, x.so_tien, x.chung_tu, x.chi_cho, x.ghi_chu, x.da_xoa,
         x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::chi_phi, data->'chi_phi') x
  on conflict (id) do update set ngay=excluded.ngay, ten_chi_phi=excluded.ten_chi_phi, nhom=excluded.nhom,
    so_tien=excluded.so_tien, chung_tu=excluded.chung_tu, chi_cho=excluded.chi_cho, ghi_chu=excluded.ghi_chu,
    da_xoa=excluded.da_xoa, version=greatest(chi_phi.version, excluded.version)+1;
  get diagnostics n_cp = row_count;

  insert into phan_quyen (user_id, cong_trinh_id)
  select x.user_id, x.cong_trinh_id from jsonb_populate_recordset(null::phan_quyen, data->'phan_quyen') x
  where exists (select 1 from profiles p where p.id = x.user_id)
  on conflict do nothing;
  get diagnostics n_pq = row_count;

  insert into tep_dinh_kem (id, cong_trinh_id, loai, ban_ghi_id, duong_dan, ten_tep, created_by, created_at)
  select x.id, x.cong_trinh_id, x.loai, x.ban_ghi_id, x.duong_dan, x.ten_tep, x.created_by, x.created_at
  from jsonb_populate_recordset(null::tep_dinh_kem, data->'tep_dinh_kem') x
  on conflict do nothing;
  get diagnostics n_tep = row_count;

  -- danh mục dùng chung (bỏ qua dòng trùng tên với dòng khác id để không vi phạm ràng buộc)
  insert into danh_muc_vat_tu (id, ten, dvt, don_gia, ghi_chu, created_by, created_at, updated_by, updated_at, version)
  select x.id, x.ten, x.dvt, x.don_gia, x.ghi_chu, x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::danh_muc_vat_tu, data->'danh_muc_vat_tu') x
  where not exists (select 1 from danh_muc_vat_tu d where d.ten = x.ten and d.id <> x.id)
  on conflict (id) do update set ten=excluded.ten, dvt=excluded.dvt, don_gia=excluded.don_gia, ghi_chu=excluded.ghi_chu,
    version=greatest(danh_muc_vat_tu.version, excluded.version)+1;
  get diagnostics n_dm = row_count;

  return jsonb_build_object('cong_trinh', n_ct, 'vat_tu_mau', n_vt, 'phieu_nhap_vt', n_pn,
                            'chi_phi', n_cp, 'phan_quyen', n_pq, 'tep_dinh_kem', n_tep, 'danh_muc_vat_tu', n_dm);
end $$;

-- Đồng bộ tức thời
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'danh_muc_vat_tu') then
    alter publication supabase_realtime add table public.danh_muc_vat_tu;
  end if;
end $$;
