-- =====================================================================
-- QUẢN LÝ CÔNG TRÌNH – Cơ sở dữ liệu (chạy trong Supabase > SQL Editor)
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Hàm dùng chung ----------
create table public.profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text,
  ho_ten    text not null default '',
  vai_tro   text not null default 'ketoan' check (vai_tro in ('admin','ketoan')),
  bi_khoa   boolean not null default false,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and vai_tro = 'admin' and not bi_khoa)
$$;

create function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and not bi_khoa)
$$;

-- Admin xem được mọi công trình; kế toán chỉ công trình được cấp
create table public.cong_trinh (
  id uuid primary key default gen_random_uuid(),
  ten text not null check (length(trim(ten)) > 0),
  chu_dau_tu text not null default '',
  dia_diem text not null default '',
  gia_tri_hop_dong numeric(18,0) not null default 0 check (gia_tri_hop_dong >= 0),
  ngay_khoi_cong date,
  ngay_hoan_thanh_dk date,
  nam int not null default extract(year from now())::int,
  ghi_chu text not null default '',
  trang_thai text not null default 'dang_thuc_hien' check (trang_thai in ('dang_thuc_hien','tam_dung','hoan_thanh')),
  luu_tru boolean not null default false,
  created_by uuid, created_at timestamptz not null default now(),
  updated_by uuid, updated_at timestamptz,
  version int not null default 1
);

create table public.phan_quyen (
  user_id uuid not null references profiles(id) on delete cascade,
  cong_trinh_id uuid not null references cong_trinh(id) on delete cascade,
  primary key (user_id, cong_trinh_id)
);

create function public.co_quyen(ct uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active() and (
    public.is_admin()
    or exists (select 1 from phan_quyen where user_id = auth.uid() and cong_trinh_id = ct)
  )
$$;

create table public.vat_tu_mau (
  id uuid primary key default gen_random_uuid(),
  cong_trinh_id uuid not null references cong_trinh(id) on delete cascade,
  ten text not null check (length(trim(ten)) > 0),
  dvt text not null check (length(trim(dvt)) > 0),
  khoi_luong_dt numeric(18,3) not null default 0 check (khoi_luong_dt >= 0),
  don_gia_dt numeric(18,2) not null default 0 check (don_gia_dt >= 0),
  thanh_tien_dt numeric generated always as (khoi_luong_dt * don_gia_dt) stored,
  created_by uuid, created_at timestamptz not null default now(),
  updated_by uuid, updated_at timestamptz,
  version int not null default 1,
  unique (cong_trinh_id, ten)
);

create table public.phieu_nhap_vt (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,                 -- chống nhập trùng (kể cả khi gửi lại sau mất mạng)
  cong_trinh_id uuid not null references cong_trinh(id) on delete cascade,
  vat_tu_id uuid not null references vat_tu_mau(id),
  ngay date not null,
  khoi_luong numeric(18,3) not null check (khoi_luong > 0),
  don_gia numeric(18,2) not null check (don_gia >= 0),
  thanh_tien numeric generated always as (khoi_luong * don_gia) stored,
  co_hoa_don boolean not null,                    -- bắt buộc chọn
  ghi_chu text not null default '',
  da_xoa boolean not null default false,
  created_by uuid, created_at timestamptz not null default now(),
  updated_by uuid, updated_at timestamptz,
  version int not null default 1
);
create index on phieu_nhap_vt (cong_trinh_id, ngay) where not da_xoa;
create index on phieu_nhap_vt (vat_tu_id) where not da_xoa;

create table public.chi_phi (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,
  cong_trinh_id uuid not null references cong_trinh(id) on delete cascade,
  ngay date not null,
  ten_chi_phi text not null check (length(trim(ten_chi_phi)) > 0),
  nhom text not null default '',                  -- tự điền, không đặt sẵn
  so_tien numeric(18,0) not null check (so_tien > 0),
  chung_tu text not null check (chung_tu in ('co_hoa_don','hdkv','khong_chung_tu')),
  chi_cho text not null default '',
  ghi_chu text not null default '',
  da_xoa boolean not null default false,
  created_by uuid, created_at timestamptz not null default now(),
  updated_by uuid, updated_at timestamptz,
  version int not null default 1
);
create index on chi_phi (cong_trinh_id, ngay) where not da_xoa;

create table public.tep_dinh_kem (
  id uuid primary key default gen_random_uuid(),
  cong_trinh_id uuid not null references cong_trinh(id) on delete cascade,
  loai text not null check (loai in ('vat_tu','chi_phi')),
  ban_ghi_id uuid not null,
  duong_dan text not null unique,
  ten_tep text not null default '',
  created_by uuid, created_at timestamptz not null default now()
);
create index on tep_dinh_kem (ban_ghi_id);

create table public.nhat_ky (
  id bigint generated always as identity primary key,
  thoi_gian timestamptz not null default now(),
  user_id uuid,
  hanh_dong text not null,       -- THEM | SUA | XOA | KHOI_PHUC | XOA_VINH_VIEN
  bang text not null,
  ban_ghi_id text,
  truoc jsonb, sau jsonb
);
create index on nhat_ky (thoi_gian desc);

-- ---------- Trigger: dấu vết, phiên bản, kiểm tra ----------
create function public.dat_dau_vet() returns trigger
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
    if tg_table_name <> 'cong_trinh' then new.cong_trinh_id := old.cong_trinh_id; end if;
    if tg_table_name in ('phieu_nhap_vt','chi_phi') then new.client_id := old.client_id; end if;
    new.updated_by := auth.uid();
    new.updated_at := now();
    new.version := old.version + 1;
  end if;
  return new;
end $$;

create function public.kiem_tra_vat_tu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from vat_tu_mau where id = new.vat_tu_id and cong_trinh_id = new.cong_trinh_id) then
    raise exception 'Vật tư không thuộc công trình này';
  end if;
  return new;
end $$;

create function public.ghi_nhat_ky() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_old jsonb; v_new jsonb; v_act text; v_id text;
begin
  if tg_op = 'INSERT' then v_new := to_jsonb(new); v_act := 'THEM'; v_id := v_new->>'id';
  elsif tg_op = 'DELETE' then v_old := to_jsonb(old); v_act := 'XOA_VINH_VIEN'; v_id := v_old->>'id';
  else
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_id := v_new->>'id';
    v_act := case
      when (v_new->>'da_xoa') = 'true' and coalesce(v_old->>'da_xoa','false') = 'false' then 'XOA'
      when (v_new->>'da_xoa') = 'false' and (v_old->>'da_xoa') = 'true' then 'KHOI_PHUC'
      else 'SUA' end;
  end if;
  insert into nhat_ky (user_id, hanh_dong, bang, ban_ghi_id, truoc, sau)
  values (auth.uid(), v_act, tg_table_name, v_id, v_old, v_new);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['cong_trinh','vat_tu_mau','phieu_nhap_vt','chi_phi'] loop
    execute format('create trigger trg_dau_vet before insert or update on public.%I for each row execute function public.dat_dau_vet()', t);
    execute format('create trigger trg_nhat_ky after insert or update or delete on public.%I for each row execute function public.ghi_nhat_ky()', t);
  end loop;
  foreach t in array array['phan_quyen','profiles','tep_dinh_kem'] loop
    execute format('create trigger trg_nhat_ky after insert or update or delete on public.%I for each row execute function public.ghi_nhat_ky()', t);
  end loop;
end $$;
-- phan_quyen/profiles không có cột id: nhật ký lưu null cho ban_ghi_id, nội dung nằm trong truoc/sau
create trigger trg_kiem_tra_vt before insert or update on public.phieu_nhap_vt
  for each row execute function public.kiem_tra_vat_tu();

-- Tạo hồ sơ khi có tài khoản mới. Người đầu tiên là Admin; vai trò chỉ lấy từ app_metadata (người dùng không tự sửa được).
create function public.tao_ho_so() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, ho_ten, vai_tro)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'ho_ten', ''),
          coalesce(new.raw_app_meta_data->>'vai_tro',
                   case when exists (select 1 from profiles) then 'ketoan' else 'admin' end));
  return new;
end $$;
create trigger trg_tao_ho_so after insert on auth.users for each row execute function public.tao_ho_so();

-- Không cho tự nâng quyền / tự mở khóa
create function public.chan_sua_ho_so() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Chỉ Admin được sửa hồ sơ tài khoản';
  end if;
  if old.vai_tro = 'admin' and new.vai_tro <> 'admin'
     and not exists (select 1 from profiles where vai_tro = 'admin' and id <> old.id and not bi_khoa) then
    raise exception 'Phải còn ít nhất một Admin đang hoạt động';
  end if;
  if old.vai_tro = 'admin' and new.bi_khoa and not old.bi_khoa
     and not exists (select 1 from profiles where vai_tro = 'admin' and id <> old.id and not bi_khoa) then
    raise exception 'Phải còn ít nhất một Admin đang hoạt động';
  end if;
  return new;
end $$;
create trigger trg_chan_sua_ho_so before update on public.profiles
  for each row execute function public.chan_sua_ho_so();

-- ---------- Phân quyền cấp dòng (RLS) ----------
alter table profiles      enable row level security;
alter table cong_trinh    enable row level security;
alter table phan_quyen    enable row level security;
alter table vat_tu_mau    enable row level security;
alter table phieu_nhap_vt enable row level security;
alter table chi_phi       enable row level security;
alter table tep_dinh_kem  enable row level security;
alter table nhat_ky       enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on profiles, cong_trinh, phan_quyen, vat_tu_mau,
      phieu_nhap_vt, chi_phi, tep_dinh_kem to authenticated;
grant select on nhat_ky to authenticated;
revoke insert, delete on profiles from authenticated;   -- chỉ trigger/Edge Function tạo hồ sơ

create policy p_prof_sel on profiles for select using (public.is_active());
create policy p_prof_upd on profiles for update using (public.is_admin()) with check (public.is_admin());

create policy p_ct_sel on cong_trinh for select using (public.co_quyen(id));
create policy p_ct_ins on cong_trinh for insert with check (public.is_admin());
create policy p_ct_upd on cong_trinh for update using (public.is_admin()) with check (public.is_admin());
create policy p_ct_del on cong_trinh for delete using (public.is_admin());

create policy p_pq_sel on phan_quyen for select using (public.is_admin() or user_id = auth.uid());
create policy p_pq_all on phan_quyen for all using (public.is_admin()) with check (public.is_admin());

create policy p_vt_sel on vat_tu_mau for select using (public.co_quyen(cong_trinh_id));
create policy p_vt_ins on vat_tu_mau for insert with check (public.is_admin());
create policy p_vt_upd on vat_tu_mau for update using (public.is_admin()) with check (public.is_admin());
create policy p_vt_del on vat_tu_mau for delete using (public.is_admin());

-- Phiếu vật tư và chi phí: kế toán chỉ sửa/xóa (xóa mềm) bản ghi do mình tạo
do $$ declare t text; begin
  foreach t in array array['phieu_nhap_vt','chi_phi'] loop
    execute format($f$create policy p_%1$s_sel on public.%1$s for select
      using (public.co_quyen(cong_trinh_id) and (not da_xoa or public.is_admin() or created_by = auth.uid()))$f$, t);
    execute format($f$create policy p_%1$s_ins on public.%1$s for insert
      with check (public.co_quyen(cong_trinh_id) and created_by = auth.uid() and not da_xoa)$f$, t);
    execute format($f$create policy p_%1$s_upd on public.%1$s for update
      using (public.is_admin() or (public.co_quyen(cong_trinh_id) and created_by = auth.uid() and not da_xoa))
      with check (public.is_admin() or (public.co_quyen(cong_trinh_id) and created_by = auth.uid()))$f$, t);
    execute format($f$create policy p_%1$s_del on public.%1$s for delete using (public.is_admin())$f$, t);
  end loop;
end $$;

create policy p_tep_sel on tep_dinh_kem for select using (public.co_quyen(cong_trinh_id));
create policy p_tep_ins on tep_dinh_kem for insert with check (public.co_quyen(cong_trinh_id) and created_by = auth.uid());
create policy p_tep_del on tep_dinh_kem for delete using (public.is_admin() or (created_by = auth.uid() and public.co_quyen(cong_trinh_id)));

create policy p_nk_sel on nhat_ky for select using (public.is_admin());

create function public.dat_created_by_tep() returns trigger language plpgsql as $$
begin new.created_by := coalesce(auth.uid(), new.created_by); return new; end $$;
create trigger trg_tep_cb before insert on tep_dinh_kem for each row execute function public.dat_created_by_tep();

-- ---------- Số liệu tổng hợp: luôn tính lại từ dữ liệu gốc ----------
create view public.v_tong_hop_vat_tu with (security_invoker = true) as
select m.id as vat_tu_id, m.cong_trinh_id, m.ten, m.dvt,
       m.khoi_luong_dt, m.don_gia_dt, m.thanh_tien_dt,
       coalesce(p.kl, 0)        as kl_thuc_te,
       m.khoi_luong_dt - coalesce(p.kl, 0)              as kl_con_lai,
       greatest(coalesce(p.kl, 0) - m.khoi_luong_dt, 0) as kl_vuot,
       coalesce(p.gt, 0)        as gia_tri_tong,
       coalesce(p.gt_hd, 0)     as gia_tri_co_hd,
       coalesce(p.gt_khd, 0)    as gia_tri_khong_hd,
       coalesce(p.kl_hd, 0)     as kl_co_hd,
       coalesce(p.kl_khd, 0)    as kl_khong_hd,
       case when coalesce(p.kl,0) > m.khoi_luong_dt then 'vuot'
            when coalesce(p.kl,0) > 0 and coalesce(p.kl,0) = m.khoi_luong_dt then 'dat'
            else 'ok' end       as canh_bao
from vat_tu_mau m
left join (
  select vat_tu_id,
         sum(khoi_luong) kl, sum(thanh_tien) gt,
         sum(thanh_tien) filter (where co_hoa_don) gt_hd,
         sum(thanh_tien) filter (where not co_hoa_don) gt_khd,
         sum(khoi_luong) filter (where co_hoa_don) kl_hd,
         sum(khoi_luong) filter (where not co_hoa_don) kl_khd
  from phieu_nhap_vt where not da_xoa group by vat_tu_id
) p on p.vat_tu_id = m.id;

create view public.v_canh_bao_vat_tu with (security_invoker = true) as
select * from public.v_tong_hop_vat_tu where canh_bao <> 'ok';

create view public.v_vat_tu_theo_thang with (security_invoker = true) as
select cong_trinh_id, to_char(date_trunc('month', ngay), 'YYYY-MM') as thang,
       sum(thanh_tien) as gia_tri_tong,
       coalesce(sum(thanh_tien) filter (where co_hoa_don), 0)     as gia_tri_co_hd,
       coalesce(sum(thanh_tien) filter (where not co_hoa_don), 0) as gia_tri_khong_hd
from phieu_nhap_vt where not da_xoa group by 1, 2;

create view public.v_chi_phi_theo_thang with (security_invoker = true) as
select cong_trinh_id, to_char(date_trunc('month', ngay), 'YYYY-MM') as thang,
       sum(so_tien) as tong,
       coalesce(sum(so_tien) filter (where chung_tu = 'co_hoa_don'), 0)     as co_hoa_don,
       coalesce(sum(so_tien) filter (where chung_tu = 'hdkv'), 0)           as hdkv,
       coalesce(sum(so_tien) filter (where chung_tu = 'khong_chung_tu'), 0) as khong_chung_tu
from chi_phi where not da_xoa group by 1, 2;

create view public.v_chi_phi_theo_nhom with (security_invoker = true) as
select cong_trinh_id, coalesce(nullif(trim(nhom), ''), '(Chưa phân nhóm)') as nhom, sum(so_tien) as tong, count(*) as so_khoan
from chi_phi where not da_xoa group by 1, 2;

create view public.v_chi_phi_theo_nguoi_nhan with (security_invoker = true) as
select cong_trinh_id, coalesce(nullif(trim(chi_cho), ''), '(Không ghi)') as chi_cho, sum(so_tien) as tong, count(*) as so_khoan
from chi_phi where not da_xoa group by 1, 2;

create view public.v_tong_quan_cong_trinh with (security_invoker = true) as
select c.id as cong_trinh_id, c.ten, c.chu_dau_tu, c.nam, c.trang_thai, c.luu_tru,
       c.gia_tri_hop_dong, c.ngay_khoi_cong, c.ngay_hoan_thanh_dk,
       coalesce(v.tong, 0) as vt_tong, coalesce(v.co_hd, 0) as vt_co_hd, coalesce(v.khong_hd, 0) as vt_khong_hd,
       coalesce(k.tong, 0) as cp_tong, coalesce(k.co_hd, 0) as cp_co_hd,
       coalesce(k.hdkv, 0) as cp_hdkv, coalesce(k.khong_ct, 0) as cp_khong_ct,
       c.gia_tri_hop_dong - coalesce(v.tong, 0) - coalesce(k.tong, 0) as chenh_lech
from cong_trinh c
left join (select cong_trinh_id, sum(thanh_tien) tong,
                  sum(thanh_tien) filter (where co_hoa_don) co_hd,
                  sum(thanh_tien) filter (where not co_hoa_don) khong_hd
           from phieu_nhap_vt where not da_xoa group by 1) v on v.cong_trinh_id = c.id
left join (select cong_trinh_id, sum(so_tien) tong,
                  sum(so_tien) filter (where chung_tu = 'co_hoa_don') co_hd,
                  sum(so_tien) filter (where chung_tu = 'hdkv') hdkv,
                  sum(so_tien) filter (where chung_tu = 'khong_chung_tu') khong_ct
           from chi_phi where not da_xoa group by 1) k on k.cong_trinh_id = c.id;

grant select on v_tong_hop_vat_tu, v_canh_bao_vat_tu, v_vat_tu_theo_thang, v_chi_phi_theo_thang,
      v_chi_phi_theo_nhom, v_chi_phi_theo_nguoi_nhan, v_tong_quan_cong_trinh to authenticated;

-- ---------- Sao lưu & phục hồi (Admin hoặc khóa service_role của lịch tự động) ----------
create function public.xuat_sao_luu() returns jsonb
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
    'tep_dinh_kem',  (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from tep_dinh_kem x));
end $$;

-- Phục hồi dạng "bổ sung/ghi đè theo id": không xóa dữ liệu hiện có. (File ảnh nằm trong Storage, không nằm trong bản sao lưu này.)
create function public.phuc_hoi_sao_luu(data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_ct int; n_vt int; n_pn int; n_cp int; n_pq int; n_tep int;
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

  return jsonb_build_object('cong_trinh', n_ct, 'vat_tu_mau', n_vt, 'phieu_nhap_vt', n_pn,
                            'chi_phi', n_cp, 'phan_quyen', n_pq, 'tep_dinh_kem', n_tep);
end $$;

-- Xóa vĩnh viễn nhật ký/ghi: không cung cấp. Khôi phục bản ghi đã xóa mềm: Admin sửa da_xoa = false.
revoke execute on function public.xuat_sao_luu(), public.phuc_hoi_sao_luu(jsonb) from public, anon;
grant execute on function public.xuat_sao_luu(), public.phuc_hoi_sao_luu(jsonb) to authenticated, service_role;
revoke execute on function public.is_admin(), public.is_active(), public.co_quyen(uuid) from public, anon;
grant execute on function public.is_admin(), public.is_active(), public.co_quyen(uuid) to authenticated, service_role;

-- Đồng bộ trực tiếp (realtime)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.phieu_nhap_vt, public.chi_phi, public.vat_tu_mau, public.cong_trinh;
  end if;
end $$;
