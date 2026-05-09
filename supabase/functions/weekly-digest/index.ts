// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://gogodeep.com";

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let sent = 0;
    let skipped = 0;

    for (const user of users) {
      if (!user.email) { skipped++; continue; }

      // Only email users who scanned in the past 7 days
      const { data: recentLogs } = await supabase
        .from("error_logs")
        .select("topic, specific_error_tag, error_category")
        .eq("student_id", user.id)
        .gte("created_at", oneWeekAgo);

      if (!recentLogs?.length) { skipped++; continue; }

      // Top weak areas all-time (up to 3)
      const { data: allLogs } = await supabase
        .from("error_logs")
        .select("topic, specific_error_tag")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const topicCount: Record<string, number> = {};
      for (const log of allLogs ?? []) {
        const t = log.specific_error_tag ?? log.topic;
        if (t) topicCount[t] = (topicCount[t] ?? 0) + 1;
      }
      const topWeakAreas = Object.entries(topicCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([topic]) => topic);

      // Most scanned topic this week
      const weeklyTopicCount: Record<string, number> = {};
      for (const log of recentLogs) {
        const t = log.specific_error_tag ?? log.topic;
        if (t) weeklyTopicCount[t] = (weeklyTopicCount[t] ?? 0) + 1;
      }
      const topTopic = Object.entries(weeklyTopicCount).sort((a, b) => b[1] - a[1])[0]?.[0];
      const conceptualCount = recentLogs.filter(l => l.error_category?.toLowerCase() === "conceptual").length;

      const username = (user.user_metadata?.username as string) ?? user.email.split("@")[0];
      const scanCount = recentLogs.length;

      const weakAreasHtml = topWeakAreas.length
        ? topWeakAreas.map(t => `<li style="margin-bottom:6px;color:#cbd5e1;">${t}</li>`).join("")
        : `<li style="color:#64748b;">Keep scanning to identify patterns.</li>`;

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:48px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#ffffff;">

  <!-- Outer wrapper centres the card -->
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td>

      <!-- Logo + mascot -->
      <div style="text-align:center;margin:0 0 24px;">
        <img src="${siteUrl}/whale-e.png" alt="Whal-E" width="56" height="56" style="border-radius:50%;object-fit:cover;display:inline-block;margin-bottom:10px;" />
        <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#1e3a5f;">GOGODEEP</p>
      </div>

      <!-- Card -->
      <div style="background:#0f1f35;border-radius:20px;padding:36px 32px;box-shadow:0 8px 40px rgba(0,0,0,0.15);">

        <!-- Header -->
        <h1 style="color:#f8fafc;font-size:26px;font-weight:800;margin:0 0 8px;line-height:1.25;text-align:center;">${username}, here's your week</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0 0 32px;line-height:1.6;text-align:center;">Here's what Gogodeep learned about your understanding this week.</p>

        <!-- Stats row: scans + most scanned side by side -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
          <tr>
            <td width="48%" style="background:#162d4a;border:1px solid #1e3f5c;border-radius:12px;padding:18px 20px;vertical-align:top;">
              <p style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 6px;">This week</p>
              <p style="color:#f8fafc;font-size:32px;font-weight:800;margin:0;line-height:1;">${scanCount}</p>
              <p style="color:#64748b;font-size:12px;margin:4px 0 0;">scan${scanCount === 1 ? "" : "s"}</p>
            </td>
            <td width="4%"></td>
            <td width="48%" style="background:#162d4a;border:1px solid #1e3f5c;border-radius:12px;padding:18px 20px;vertical-align:top;">
              <p style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 6px;">Most scanned</p>
              <p style="color:#f8fafc;font-size:15px;font-weight:700;margin:0;line-height:1.3;">${topTopic ?? "—"}</p>
            </td>
          </tr>
        </table>

        <!-- Weak areas -->
        ${topWeakAreas.length ? `
        <div style="background:#162d4a;border:1px solid #1e3f5c;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
          <p style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 14px;">Your recurring weak areas</p>
          ${topWeakAreas.map(t => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div style="width:6px;height:6px;border-radius:50%;background:#3b82f6;flex-shrink:0;"></div>
            <span style="color:#cbd5e1;font-size:14px;">${t}</span>
          </div>`).join("")}
        </div>` : ""}

        <!-- CTA -->
        <a href="${siteUrl}/workspace" style="display:block;background:#3b82f6;color:#ffffff;text-align:center;padding:15px 24px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:0.01em;">
          Scan something today →
        </a>

      </div>

      <!-- Footer -->
      <p style="color:#94a3b8;font-size:12px;text-align:center;margin:24px 0 0;line-height:1.6;">
        You're getting this because you have a Gogodeep account.<br>
        <a href="${siteUrl}/unsubscribe?email=${encodeURIComponent(user.email)}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
      </p>

    </td></tr>
  </table>

</body>
</html>`;

      const unsubscribeUrl = `${siteUrl}/unsubscribe?email=${encodeURIComponent(user.email)}`;
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Gogodeep <noreply@auth.gogodeep.com>",
          to: [user.email],
          subject: `${scanCount} scan${scanCount === 1 ? "" : "s"} this week${topTopic ? ` · focus: ${topTopic}` : ""}`,
          html,
          headers: {
            "List-Unsubscribe": `<mailto:unsubscribe@gogodeep.com?subject=unsubscribe&body=${encodeURIComponent(user.email)}>, <${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });

      if (emailRes.ok) sent++;
      else {
        const err = await emailRes.text();
        console.error(`Failed to send to ${user.email}:`, err);
      }
    }

    return new Response(JSON.stringify({ sent, skipped }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("weekly-digest error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
