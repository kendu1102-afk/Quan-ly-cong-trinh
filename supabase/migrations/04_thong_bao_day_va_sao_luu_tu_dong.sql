-- =====================================================================
-- Bổ sung 04: THÔNG BÁO ĐẨY + SAO LƯU TỰ ĐỘNG
-- (chạy trong Supabase > SQL Editor SAU 01, 02, 03; chạy lại nhiều lần không hỏng dữ liệu)
-- =====================================================================

-- ---------- Kho cấu hình bí mật (client KHÔNG đọc được; chỉ hàm máy chủ đọc) ----------
create table if not exists public.cau_hinh_bi_mat (khoa text primary key, gia_tri text not null);
alter table public.cau_hinh_bi_mat enable row level security;
revoke all on public.cau_hinh_bi_mat from anon, authenticated;
insert into public.cau_hinh_bi_mat (khoa, gia_tri) values
  ('ma_sao_luu',       replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  ('ma_day_thong_bao', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (khoa) do nothing;

-- ---------- Sao lưu: tách phần tạo dữ liệu (không kiểm quyền, chỉ nội bộ) ----------
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
    'danh_muc_vat_tu', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from danh_muc_vat_tu x))
$$;
revoke execute on function public.tao_du_lieu_sao_luu() from public, anon, authenticated;

create or replace function public.xuat_sao_luu() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then raise exception 'Chỉ Admin được sao lưu'; end if;
  return public.tao_du_lieu_sao_luu();
end $$;

-- Bản sao lưu tự động nằm ngay trong cơ sở dữ liệu (giữ 30 bản mới nhất, bỏ qua nếu dữ liệu không đổi)
create table if not exists public.sao_luu_tu_dong (
  id bigint generated always as identity primary key,
  thoi_gian timestamptz not null default now(),
  dau_van_tay text not null,
  kich_thuoc int not null,
  tom_tat jsonb not null,
  du_lieu jsonb not null
);
alter table public.sao_luu_tu_dong enable row level security;
revoke all on public.sao_luu_tu_dong from anon, authenticated;
grant select (id, thoi_gian, kich_thuoc, tom_tat) on public.sao_luu_tu_dong to authenticated;   -- không cấp cột du_lieu
drop policy if exists p_sltd_sel on public.sao_luu_tu_dong;
create policy p_sltd_sel on public.sao_luu_tu_dong for select using (public.is_admin());

create or replace function public.chay_sao_luu_tu_dong(giu int default 30) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d jsonb; h text; cu text; sz int;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Chỉ Admin được sao lưu'; end if;
  d := public.tao_du_lieu_sao_luu();
  h := md5((d - 'thoi_gian')::text);
  select dau_van_tay into cu from sao_luu_tu_dong order by id desc limit 1;
  if cu = h then return jsonb_build_object('ket_qua', 'khong_doi'); end if;
  sz := octet_length(d::text);
  insert into sao_luu_tu_dong (dau_van_tay, kich_thuoc, tom_tat, du_lieu)
  values (h, sz, jsonb_build_object(
    'cong_trinh', jsonb_array_length(d->'cong_trinh'), 'vat_tu_mau', jsonb_array_length(d->'vat_tu_mau'),
    'phieu_nhap_vt', jsonb_array_length(d->'phieu_nhap_vt'), 'chi_phi', jsonb_array_length(d->'chi_phi'),
    'danh_muc_vat_tu', jsonb_array_length(d->'danh_muc_vat_tu')), d);
  delete from sao_luu_tu_dong where id not in (select id from sao_luu_tu_dong order by id desc limit greatest(giu, 1));
  return jsonb_build_object('ket_qua', 'da_luu', 'kich_thuoc', sz);
end $$;
revoke execute on function public.chay_sao_luu_tu_dong(int) from public, anon;
grant execute on function public.chay_sao_luu_tu_dong(int) to authenticated, service_role;

create or replace function public.lay_sao_luu_tu_dong(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Chỉ Admin được xem sao lưu'; end if;
  return (select du_lieu from sao_luu_tu_dong where id = p_id);
end $$;
revoke execute on function public.lay_sao_luu_tu_dong(bigint) from public, anon;
grant execute on function public.lay_sao_luu_tu_dong(bigint) to authenticated;

-- Sao lưu "ra ngoài" cho lịch GitHub: gọi bằng mã bí mật (không dùng khóa service_role)
create or replace function public.lay_sao_luu_ngoai(ma text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if ma is null or ma <> (select gia_tri from cau_hinh_bi_mat where khoa = 'ma_sao_luu') then
    raise exception 'Mã sao lưu không đúng';
  end if;
  return public.tao_du_lieu_sao_luu();
end $$;
grant execute on function public.lay_sao_luu_ngoai(text) to anon, authenticated;

create or replace function public.xem_ma_sao_luu() returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Chỉ Admin'; end if;
  return (select gia_tri from cau_hinh_bi_mat where khoa = 'ma_sao_luu');
end $$;
create or replace function public.doi_ma_sao_luu() returns text
language plpgsql security definer set search_path = public as $$
declare m text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.is_admin() then raise exception 'Chỉ Admin'; end if;
  update cau_hinh_bi_mat set gia_tri = m where khoa = 'ma_sao_luu';
  return m;
end $$;
revoke execute on function public.xem_ma_sao_luu(), public.doi_ma_sao_luu() from public, anon;
grant execute on function public.xem_ma_sao_luu(), public.doi_ma_sao_luu() to authenticated;

-- Lịch chạy mỗi đêm 03:00 giờ Việt Nam (20:00 UTC). Cần bật tiện ích pg_cron (Database > Extensions).
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('sao-luu-tu-dong', '0 20 * * *', 'select public.chay_sao_luu_tu_dong(30)');
exception when others then
  raise notice 'CHƯA đặt được lịch sao lưu (pg_cron): %. Hãy bật pg_cron ở Database > Extensions rồi chạy lại tệp này.', sqlerrm;
end $$;

-- ---------- Thông báo đẩy ----------
create table if not exists public.thiet_bi_nhan_tin (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ten_may text not null default '',
  created_at timestamptz not null default now()
);
alter table public.thiet_bi_nhan_tin enable row level security;
revoke all on public.thiet_bi_nhan_tin from anon, authenticated;
grant select on public.thiet_bi_nhan_tin to authenticated;            -- ghi qua hàm dang_ky_thiet_bi
drop policy if exists p_tb_sel on public.thiet_bi_nhan_tin;
create policy p_tb_sel on public.thiet_bi_nhan_tin for select using (user_id = auth.uid());

create or replace function public.dang_ky_thiet_bi(p_endpoint text, p_p256dh text, p_auth text, p_ten_may text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_active() then raise exception 'Chưa đăng nhập'; end if;
  delete from thiet_bi_nhan_tin where endpoint = p_endpoint;       -- cùng một máy đổi tài khoản
  insert into thiet_bi_nhan_tin (user_id, endpoint, p256dh, auth, ten_may) values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_ten_may, ''), 200));
end $$;
create or replace function public.huy_dang_ky_thiet_bi(p_endpoint text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from thiet_bi_nhan_tin where endpoint = p_endpoint and user_id = auth.uid();
end $$;
revoke execute on function public.dang_ky_thiet_bi(text, text, text, text), public.huy_dang_ky_thiet_bi(text) from public, anon;
grant execute on function public.dang_ky_thiet_bi(text, text, text, text), public.huy_dang_ky_thiet_bi(text) to authenticated;

-- Trạng thái cảnh báo đã báo (để mỗi mức chỉ báo một lần) và hàng đợi thông báo
create table if not exists public.canh_bao_trang_thai (
  vat_tu_id uuid primary key references public.vat_tu_mau(id) on delete cascade,
  ghi_nhan text not null
);
alter table public.canh_bao_trang_thai enable row level security;
revoke all on public.canh_bao_trang_thai from anon, authenticated;

create table if not exists public.thong_bao_day (
  id bigint generated always as identity primary key,
  thoi_gian timestamptz not null default now(),
  cong_trinh_id uuid not null,
  vat_tu_id uuid,
  tieu_de text not null,
  noi_dung text not null,
  da_gui boolean not null default false,
  ket_qua jsonb
);
alter table public.thong_bao_day enable row level security;
revoke all on public.thong_bao_day from anon, authenticated;

-- Gọi Edge Function qua pg_net (nếu đã bật & đã cấu hình). Không bao giờ làm hỏng việc nhập liệu.
create or replace function public.gui_day_thong_bao(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare u text; ma text; ak text;
begin
  select gia_tri into u  from cau_hinh_bi_mat where khoa = 'url_day_thong_bao';
  select gia_tri into ma from cau_hinh_bi_mat where khoa = 'ma_day_thong_bao';
  select gia_tri into ak from cau_hinh_bi_mat where khoa = 'khoa_anon';
  if u is null or to_regnamespace('net') is null then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using u, jsonb_build_object('hanh_dong', 'day_thong_bao', 'id', p_id),
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(ak, ''), 'apikey', coalesce(ak, ''), 'x-ma-day', ma);
exception when others then
  raise warning 'Không gửi được thông báo đẩy: %', sqlerrm;
end $$;
revoke execute on function public.gui_day_thong_bao(bigint) from public, anon, authenticated;

create or replace function public.xet_canh_bao_vat_tu(p_vat_tu uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; st text; tag text; cu text; xau_di boolean; nid bigint;
begin
  select m.ten, m.dvt, m.khoi_luong_dt as dt, m.cong_trinh_id, c.ten as ten_ct,
         coalesce((select sum(p.khoi_luong) from phieu_nhap_vt p where p.vat_tu_id = m.id and not p.da_xoa), 0) as kl
    into r from vat_tu_mau m join cong_trinh c on c.id = m.cong_trinh_id where m.id = p_vat_tu;
  if not found then return; end if;
  st := case when r.kl > r.dt then 'vuot' when r.kl > 0 and r.kl = r.dt then 'dat' else 'ok' end;
  if st = 'ok' then delete from canh_bao_trang_thai where vat_tu_id = p_vat_tu; return; end if;
  tag := st || ':' || trim_scale(r.kl)::text;
  select ghi_nhan into cu from canh_bao_trang_thai where vat_tu_id = p_vat_tu;
  if cu = tag then return; end if;
  -- chỉ báo khi tình trạng XẤU ĐI (mới đạt, mới vượt, hoặc vượt thêm); giảm bớt thì chỉ cập nhật mốc, không báo lại
  xau_di := cu is null
            or (split_part(cu, ':', 1) = 'dat' and st = 'vuot')
            or (split_part(cu, ':', 1) = st and r.kl > split_part(cu, ':', 2)::numeric);
  insert into canh_bao_trang_thai (vat_tu_id, ghi_nhan) values (p_vat_tu, tag)
    on conflict (vat_tu_id) do update set ghi_nhan = excluded.ghi_nhan;
  if not xau_di then return; end if;
  insert into thong_bao_day (cong_trinh_id, vat_tu_id, tieu_de, noi_dung)
  values (r.cong_trinh_id, p_vat_tu,
          case st when 'vuot' then 'Vật tư VƯỢT dự toán' else 'Vật tư ĐÃ ĐẠT dự toán' end,
          r.ten_ct || ' · ' || r.ten || ': dự toán ' || trim_scale(r.dt)::text || ' ' || r.dvt || ', đã nhập ' || trim_scale(r.kl)::text ||
          case st when 'vuot' then ' — VƯỢT ' || trim_scale(r.kl - r.dt)::text || ' ' || r.dvt else ' — còn 0' end)
  returning id into nid;
  perform public.gui_day_thong_bao(nid);
end $$;
revoke execute on function public.xet_canh_bao_vat_tu(uuid) from public, anon, authenticated;

create or replace function public.trg_canh_bao_phieu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.phuc_hoi', true) = 'on' then return null; end if;
  begin
    if tg_op in ('INSERT', 'UPDATE') then perform public.xet_canh_bao_vat_tu(new.vat_tu_id); end if;
    if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.vat_tu_id <> new.vat_tu_id) then perform public.xet_canh_bao_vat_tu(old.vat_tu_id); end if;
  exception when others then
    raise warning 'Lỗi xét cảnh báo vật tư: %', sqlerrm;   -- không chặn việc nhập liệu
  end;
  return null;
end $$;
drop trigger if exists trg_canh_bao on public.phieu_nhap_vt;
create trigger trg_canh_bao after insert or update or delete on public.phieu_nhap_vt for each row execute function public.trg_canh_bao_phieu();
