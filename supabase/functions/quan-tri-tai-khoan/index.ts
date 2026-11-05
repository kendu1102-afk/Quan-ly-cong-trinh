// Edge Function: Admin tạo tài khoản kế toán, đặt lại mật khẩu. Khóa bí mật chỉ nằm ở máy chủ Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ loi: "Chưa đăng nhập" }, 401);
    const { data: me } = await admin.from("profiles").select("vai_tro,bi_khoa").eq("id", u.user.id).single();
    if (!me || me.vai_tro !== "admin" || me.bi_khoa) return json({ loi: "Chỉ Admin được thực hiện" }, 403);

    const b = await req.json();
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
