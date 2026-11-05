// Edge Function duy nhất của phần mềm:
//   tao / doi_mat_khau   : Admin tạo tài khoản kế toán, đổi mật khẩu
//   khoa_vapid           : người dùng đã đăng nhập lấy khóa công khai để đăng ký nhận thông báo đẩy
//   gui_thu              : gửi thử thông báo đẩy tới các thiết bị của chính mình
//   day_thong_bao        : cơ sở dữ liệu gọi (qua pg_net, kèm mã bí mật) để gửi cảnh báo vật tư tới điện thoại
// Khóa bí mật chỉ nằm ở máy chủ Supabase. Hàm tự kiểm tra quyền nên có thể TẮT "Enforce JWT verification".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ma-day",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Admin = any;

async function layCauHinh(admin: Admin, khoa: string): Promise<string | null> {
  const { data } = await admin.from("cau_hinh_bi_mat").select("gia_tri").eq("khoa", khoa).maybeSingle();
  return data?.gia_tri ?? null;
}

/** Tạo cặp khóa VAPID ở lần đầu và lưu vào CSDL (không cần ai nhập khóa thủ công). */
async function layVapid(admin: Admin) {
  let pub = await layCauHinh(admin, "vapid_cong_khai");
  let pri = await layCauHinh(admin, "vapid_bi_mat");
  if (!pub || !pri) {
    const k = webpush.generateVAPIDKeys();
    await admin.from("cau_hinh_bi_mat").upsert([
      { khoa: "vapid_cong_khai", gia_tri: k.publicKey },
      { khoa: "vapid_bi_mat", gia_tri: k.privateKey },
    ], { onConflict: "khoa", ignoreDuplicates: true });
    pub = await layCauHinh(admin, "vapid_cong_khai");   // đọc lại phòng hai yêu cầu tạo cùng lúc
    pri = await layCauHinh(admin, "vapid_bi_mat");
  }
  return { pub: pub!, pri: pri! };
}

async function guiToi(admin: Admin, userIds: string[], noiDung: Record<string, string>) {
  const { pub, pri } = await layVapid(admin);
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:no-reply@qlct.example";
  const { data: subs } = await admin.from("thiet_bi_nhan_tin").select("*").in("user_id", userIds);
  let daGui = 0, loi = 0, hong = 0;
  await Promise.all((subs ?? []).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(noiDung),
        { vapidDetails: { subject, publicKey: pub, privateKey: pri }, TTL: 6 * 3600, urgency: "high" },
      );
      daGui++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { hong++; await admin.from("thiet_bi_nhan_tin").delete().eq("id", s.id); }   // thiết bị đã gỡ
      else loi++;
    }
  }));
  return { thiet_bi: subs?.length ?? 0, da_gui: daGui, loi, da_xoa_thiet_bi_hong: hong };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const b = await req.json();

    // --- Do cơ sở dữ liệu gọi: xác thực bằng mã bí mật, không dùng đăng nhập người dùng ---
    if (b.hanh_dong === "day_thong_bao") {
      const ma = await layCauHinh(admin, "ma_day_thong_bao");
      if (!ma || req.headers.get("x-ma-day") !== ma) return json({ loi: "Không hợp lệ" }, 401);
      const { data: tb } = await admin.from("thong_bao_day").select("*").eq("id", b.id).maybeSingle();
      if (!tb) return json({ loi: "Không có thông báo" }, 404);
      if (tb.da_gui) return json({ ok: true, bo_qua: true });
      const { data: ad } = await admin.from("profiles").select("id").eq("vai_tro", "admin").eq("bi_khoa", false);
      const { data: pq } = await admin.from("phan_quyen").select("user_id").eq("cong_trinh_id", tb.cong_trinh_id);
      const ids = new Set<string>((ad ?? []).map((x: { id: string }) => x.id));
      const { data: kt } = await admin.from("profiles").select("id").in("id", (pq ?? []).map((x: { user_id: string }) => x.user_id)).eq("bi_khoa", false);
      (kt ?? []).forEach((x: { id: string }) => ids.add(x.id));
      const kq = await guiToi(admin, [...ids], {
        tieu_de: tb.tieu_de, noi_dung: tb.noi_dung, url: `/#/ct/${tb.cong_trinh_id}/th-vt`, tag: `cb-${tb.vat_tu_id ?? tb.id}`,
      });
      await admin.from("thong_bao_day").update({ da_gui: true, ket_qua: kq }).eq("id", tb.id);
      return json({ ok: true, ...kq });
    }

    // --- Còn lại: bắt buộc đăng nhập ---
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ loi: "Chưa đăng nhập" }, 401);
    const { data: me } = await admin.from("profiles").select("vai_tro,bi_khoa").eq("id", u.user.id).single();
    if (!me || me.bi_khoa) return json({ loi: "Tài khoản bị khóa" }, 403);

    if (b.hanh_dong === "khoa_vapid") {
      const { pub } = await layVapid(admin);
      return json({ ok: true, khoa_cong_khai: pub });
    }
    if (b.hanh_dong === "gui_thu") {
      const kq = await guiToi(admin, [u.user.id], { tieu_de: "Thông báo thử", noi_dung: "Thiết bị của bạn đã nhận được thông báo từ Quản Lý Công Trình.", url: "/#/", tag: "thu" });
      return json({ ok: true, ...kq });
    }

    // --- Chỉ Admin ---
    if (me.vai_tro !== "admin") return json({ loi: "Chỉ Admin được thực hiện" }, 403);
    if (b.hanh_dong === "tao") {
      const ten = String(b.ten_dang_nhap ?? "").trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(ten)) return json({ loi: "Tên đăng nhập 3–30 ký tự: chữ không dấu, số, . _ -" }, 400);
      if (String(b.mat_khau ?? "").length < 8) return json({ loi: "Mật khẩu tối thiểu 8 ký tự" }, 400);
      const email = ten.includes("@") ? ten : `${ten}@qlct.example`;
      const { data, error } = await admin.auth.admin.createUser({
        email, password: b.mat_khau, email_confirm: true,
        user_metadata: { ho_ten: String(b.ho_ten ?? "") }, app_metadata: { vai_tro: "ketoan" },
      });
      if (error) return json({ loi: error.message }, 400);
      return json({ ok: true, id: data.user.id, email });
    }
    if (b.hanh_dong === "doi_mat_khau") {
      if (String(b.mat_khau ?? "").length < 8) return json({ loi: "Mật khẩu tối thiểu 8 ký tự" }, 400);
      const { error } = await admin.auth.admin.updateUserById(b.user_id, { password: b.mat_khau });
      if (error) return json({ loi: error.message }, 400);
      return json({ ok: true });
    }
    return json({ loi: "Hành động không hợp lệ" }, 400);
  } catch (e) {
    return json({ loi: String(e) }, 500);
  }
});
