-- =====================================================================
-- Bổ sung 06: KHỐI LƯỢNG HỢP ĐỒNG THEO HẠNG MỤC, KHỐI LƯỢNG HOÀN THÀNH, THANH TOÁN
-- Chạy trong Supabase > SQL Editor SAU 01..05; chạy lại nhiều lần không hỏng dữ liệu.
--  * Admin nhập/sửa/xóa hạng mục hợp đồng (tên, đơn vị, khối lượng, đơn giá), kể cả nhập từ Excel.
--  * Kế toán được cấp quyền công trình chỉ cập nhật "khối lượng đã hoàn thành" (qua hàm riêng, có kiểm tra).
--  * Admin nhập các lần thanh toán; số tiền chưa thanh toán = giá trị hợp đồng - tổng đã thanh toán (tự tính).
-- =====================================================================
create table if not exists public.hang_muc_hop_dong (
  id uuid primary key default gen_random_uuid(),
  cong_trinh_id uuid not null references public.cong_trinh(id) on delete cascade,
  stt text not null check (length(trim(stt)) > 0),
  thu_tu int not null default 0,
  ten text not null check (length(trim(ten)) > 0),
  dvt text not null check (length(trim(dvt)) > 0),
  khoi_luong_hd numeric(18,3) not null check (khoi_luong_hd > 0),
  don_gia_hd numeric(18,2) not null default 0 check (don_gia_hd >= 0),
  thanh_tien_hd numeric generated always as (khoi_luong_hd * don_gia_hd) stored,
  khoi_luong_hoan_thanh numeric(18,3) not null default 0 check (khoi_luong_hoan_thanh >= 0),
  created_by uuid, created_at timestamptz not null default now(),
  updated_by uuid, updated_at timestamptz,
  version int not null default 1,
  constraint hm_hoan_thanh_hop_le check (khoi_luong_hoan_thanh <= khoi_luong_hd),
  unique (cong_trinh_id, stt)
);
create index if not exists hm_ct_thu_tu on public.hang_muc_hop_dong (cong_trinh_id, thu_tu);

create table if not exists public.thanh_toan (
  id uuid primary key default gen_random_uuid(),
  cong_trinh_id uuid not null references public.cong_trinh(id) on delete cascade,
  lan int not null check (lan > 0),
  ngay date,
  gia_tri numeric(18,0) not null check (gia_tri > 0),
  ghi_chu text not null default '',
  created_by uuid, created_at timestamptz not null default now(),
  updated_by uuid, updated_at timestamptz,
  version int not null default 1,
  unique (cong_trinh_id, lan)
);

-- Hàm dấu vết: áp dụng ép công trình cố định cho cả 2 bảng mới
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
    if tg_table_name in ('vat_tu_mau','phieu_nhap_vt','chi_phi','hang_muc_hop_dong','thanh_toan') then new.cong_trinh_id := old.cong_trinh_id; end if;
    if tg_table_name in ('phieu_nhap_vt','chi_phi') then new.client_id := old.client_id; end if;
    new.updated_by := auth.uid();
    new.updated_at := now();
    new.version := old.version + 1;
  end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['hang_muc_hop_dong','thanh_toan'] loop
    execute format('drop trigger if exists trg_dau_vet on public.%I', t);
    execute format('create trigger trg_dau_vet before insert or update on public.%I for each row execute function public.dat_dau_vet()', t);
    execute format('drop trigger if exists trg_nhat_ky on public.%I', t);
    execute format('create trigger trg_nhat_ky after insert or update or delete on public.%I for each row execute function public.ghi_nhat_ky()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists p_%1$s_sel on public.%1$s', t);
    execute format('drop policy if exists p_%1$s_ins on public.%1$s', t);
    execute format('drop policy if exists p_%1$s_upd on public.%1$s', t);
    execute format('drop policy if exists p_%1$s_del on public.%1$s', t);
    execute format('create policy p_%1$s_sel on public.%1$s for select using (public.co_quyen(cong_trinh_id))', t);
    execute format('create policy p_%1$s_ins on public.%1$s for insert with check (public.is_admin())', t);
    execute format('create policy p_%1$s_upd on public.%1$s for update using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy p_%1$s_del on public.%1$s for delete using (public.is_admin())', t);
  end loop;
end $$;

-- Kế toán cập nhật khối lượng đã hoàn thành: chỉ đúng cột này, có kiểm tra quyền, giới hạn và xung đột
create or replace function public.cap_nhat_khoi_luong_hoan_thanh(p_id uuid, p_kl numeric, p_version int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; n int;
begin
  select * into r from hang_muc_hop_dong where id = p_id;
  if not found then raise exception 'Không tìm thấy hạng mục'; end if;
  if not public.co_quyen(r.cong_trinh_id) then raise exception 'Bạn không có quyền với công trình này'; end if;
  if p_kl is null or p_kl < 0 then raise exception 'Khối lượng không hợp lệ'; end if;
  if p_kl > r.khoi_luong_hd then
    raise exception 'Khối lượng hoàn thành (%) không được vượt khối lượng hợp đồng (%). Nếu có phát sinh, nhờ Admin điều chỉnh khối lượng hợp đồng.', trim_scale(p_kl)::text, trim_scale(r.khoi_luong_hd)::text;
  end if;
  update hang_muc_hop_dong set khoi_luong_hoan_thanh = p_kl where id = p_id and (p_version is null or version = p_version);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Hạng mục vừa được người khác cập nhật, hãy tải lại rồi nhập lại'; end if;
  return (select jsonb_build_object('khoi_luong_hoan_thanh', khoi_luong_hoan_thanh, 'version', version) from hang_muc_hop_dong where id = p_id);
end $$;
revoke execute on function public.cap_nhat_khoi_luong_hoan_thanh(uuid, numeric, int) from public, anon;
grant execute on function public.cap_nhat_khoi_luong_hoan_thanh(uuid, numeric, int) to authenticated;

-- Số liệu tổng hợp luôn tính từ dữ liệu gốc
create or replace view public.v_tien_do_thuc_hien with (security_invoker = true) as
select c.id as cong_trinh_id,
       count(h.id) as so_hang_muc,
       coalesce(sum(h.thanh_tien_hd), 0) as gia_tri_hang_muc,
       coalesce(sum(h.khoi_luong_hoan_thanh * h.don_gia_hd), 0) as gia_tri_thuc_hien,
       count(h.id) filter (where h.khoi_luong_hoan_thanh >= h.khoi_luong_hd) as so_hoan_thanh
from cong_trinh c left join hang_muc_hop_dong h on h.cong_trinh_id = c.id group by c.id;

create or replace view public.v_thanh_toan_tong with (security_invoker = true) as
select c.id as cong_trinh_id, coalesce(sum(t.gia_tri), 0) as tong_thanh_toan, count(t.id) as so_lan
from cong_trinh c left join thanh_toan t on t.cong_trinh_id = c.id group by c.id;
grant select on public.v_tien_do_thuc_hien, public.v_thanh_toan_tong to authenticated;

create or replace view public.v_tong_quan_cong_trinh with (security_invoker = true) as
select c.id as cong_trinh_id, c.ten, c.chu_dau_tu, c.nam, c.trang_thai, c.luu_tru,
       c.gia_tri_hop_dong, c.ngay_khoi_cong, c.ngay_hoan_thanh_dk,
       coalesce(v.tong, 0) as vt_tong, coalesce(v.co_hd, 0) as vt_co_hd, coalesce(v.khong_hd, 0) as vt_khong_hd,
       coalesce(k.tong, 0) as cp_tong, coalesce(k.co_hd, 0) as cp_co_hd,
       coalesce(k.hdkv, 0) as cp_hdkv, coalesce(k.khong_ct, 0) as cp_khong_ct,
       c.gia_tri_hop_dong - coalesce(v.tong, 0) - coalesce(k.tong, 0) as chenh_lech,
       c.so_hop_dong, c.ngay_ky_hop_dong, c.tien_do, c.ngay_ky_bb_ban_giao,
       td.gia_tri_thuc_hien, tt.tong_thanh_toan, c.gia_tri_hop_dong - tt.tong_thanh_toan as chua_thanh_toan
from cong_trinh c
left join (select cong_trinh_id, sum(thanh_tien) tong,
                  sum(thanh_tien) filter (where co_hoa_don) co_hd,
                  sum(thanh_tien) filter (where not co_hoa_don) khong_hd
           from phieu_nhap_vt where not da_xoa group by 1) v on v.cong_trinh_id = c.id
left join (select cong_trinh_id, sum(so_tien) tong,
                  sum(so_tien) filter (where chung_tu = 'co_hoa_don') co_hd,
                  sum(so_tien) filter (where chung_tu = 'hdkv') hdkv,
                  sum(so_tien) filter (where chung_tu = 'khong_chung_tu') khong_ct
           from chi_phi where not da_xoa group by 1) k on k.cong_trinh_id = c.id
left join public.v_tien_do_thuc_hien td on td.cong_trinh_id = c.id
left join public.v_thanh_toan_tong tt on tt.cong_trinh_id = c.id;

-- Sao lưu: thêm 2 bảng mới
create or replace function public.tao_du_lieu_sao_luu() returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'phien_ban', 1, 'thoi_gian', now(),
    'profiles',      (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from profiles x),
    'cong_trinh',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from cong_trinh x),
    'phan_quyen',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from phan_quyen x),
    'vat_tu_mau',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from vat_tu_mau x),
    'phieu_nhap_vt', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from phieu_nhap_vt x),
    'chi_phi',       (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from chi_phi x),
    'tep_dinh_kem',  (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from tep_dinh_kem x),
    'danh_muc_vat_tu', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from danh_muc_vat_tu x),
    'hang_muc_hop_dong', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from hang_muc_hop_dong x),
    'thanh_toan',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from thanh_toan x))
$$;
revoke execute on function public.tao_du_lieu_sao_luu() from public, anon, authenticated;

-- Phục hồi sao lưu: nhận thêm 2 bảng mới
create or replace function public.phuc_hoi_sao_luu(data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_ct int; n_vt int; n_pn int; n_cp int; n_pq int; n_tep int; n_dm int; n_hm int; n_tt int;
begin
  if not public.is_admin() then raise exception 'Chỉ Admin được phục hồi'; end if;
  if coalesce((data->>'phien_ban')::int, 0) <> 1 then raise exception 'Tệp sao lưu không hợp lệ'; end if;
  perform set_config('app.phuc_hoi', 'on', true);

  insert into cong_trinh (id, ten, chu_dau_tu, dia_diem, gia_tri_hop_dong, ngay_khoi_cong, ngay_hoan_thanh_dk,
                          nam, ghi_chu, trang_thai, luu_tru, so_hop_dong, ngay_ky_hop_dong, tien_do, ngay_ky_bb_ban_giao, created_by, created_at, updated_by, updated_at, version)
  select x.id, x.ten, x.chu_dau_tu, x.dia_diem, x.gia_tri_hop_dong, x.ngay_khoi_cong, x.ngay_hoan_thanh_dk,
         x.nam, x.ghi_chu, x.trang_thai, x.luu_tru, coalesce(x.so_hop_dong, ''), x.ngay_ky_hop_dong, coalesce(x.tien_do, ''), x.ngay_ky_bb_ban_giao, x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::cong_trinh, data->'cong_trinh') x
  on conflict (id) do update set ten=excluded.ten, chu_dau_tu=excluded.chu_dau_tu, dia_diem=excluded.dia_diem,
    gia_tri_hop_dong=excluded.gia_tri_hop_dong, ngay_khoi_cong=excluded.ngay_khoi_cong,
    ngay_hoan_thanh_dk=excluded.ngay_hoan_thanh_dk, nam=excluded.nam, ghi_chu=excluded.ghi_chu,
    trang_thai=excluded.trang_thai, luu_tru=excluded.luu_tru, so_hop_dong=excluded.so_hop_dong, ngay_ky_hop_dong=excluded.ngay_ky_hop_dong,
    tien_do=excluded.tien_do, ngay_ky_bb_ban_giao=excluded.ngay_ky_bb_ban_giao, version=greatest(cong_trinh.version, excluded.version)+1;
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

  -- hạng mục khối lượng hợp đồng (bỏ qua dòng trùng STT khác id để không vi phạm ràng buộc)
  insert into hang_muc_hop_dong (id, cong_trinh_id, stt, thu_tu, ten, dvt, khoi_luong_hd, don_gia_hd, khoi_luong_hoan_thanh,
                                 created_by, created_at, updated_by, updated_at, version)
  select x.id, x.cong_trinh_id, x.stt, coalesce(x.thu_tu, 0), x.ten, x.dvt, x.khoi_luong_hd, x.don_gia_hd, coalesce(x.khoi_luong_hoan_thanh, 0),
         x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::hang_muc_hop_dong, data->'hang_muc_hop_dong') x
  where not exists (select 1 from hang_muc_hop_dong d where d.cong_trinh_id = x.cong_trinh_id and d.stt = x.stt and d.id <> x.id)
  on conflict (id) do update set stt=excluded.stt, thu_tu=excluded.thu_tu, ten=excluded.ten, dvt=excluded.dvt,
    khoi_luong_hd=excluded.khoi_luong_hd, don_gia_hd=excluded.don_gia_hd, khoi_luong_hoan_thanh=excluded.khoi_luong_hoan_thanh,
    version=greatest(hang_muc_hop_dong.version, excluded.version)+1;
  get diagnostics n_hm = row_count;

  insert into thanh_toan (id, cong_trinh_id, lan, ngay, gia_tri, ghi_chu, created_by, created_at, updated_by, updated_at, version)
  select x.id, x.cong_trinh_id, x.lan, x.ngay, x.gia_tri, coalesce(x.ghi_chu, ''), x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::thanh_toan, data->'thanh_toan') x
  where not exists (select 1 from thanh_toan d where d.cong_trinh_id = x.cong_trinh_id and d.lan = x.lan and d.id <> x.id)
  on conflict (id) do update set lan=excluded.lan, ngay=excluded.ngay, gia_tri=excluded.gia_tri, ghi_chu=excluded.ghi_chu,
    version=greatest(thanh_toan.version, excluded.version)+1;
  get diagnostics n_tt = row_count;

  return jsonb_build_object('cong_trinh', n_ct, 'vat_tu_mau', n_vt, 'phieu_nhap_vt', n_pn,
                            'chi_phi', n_cp, 'phan_quyen', n_pq, 'tep_dinh_kem', n_tep, 'danh_muc_vat_tu', n_dm, 'hang_muc_hop_dong', n_hm, 'thanh_toan', n_tt);
end $$;

-- Đồng bộ tức thời
do $$ declare t text; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['hang_muc_hop_dong','thanh_toan'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
