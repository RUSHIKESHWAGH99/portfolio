/**
 * Vercel serverless: emails SQL quiz results via Resend.
 *
 * Env (Vercel project settings):
 *   RESEND_API_KEY   — required (https://resend.com)
 *   RESEND_FROM      — optional, default "Portfolio Quiz <onboarding@resend.dev>"
 *   QUIZ_OWNER_EMAIL — optional copy to you; default rushikeshwagh43@gmail.com
 */

const OWNER_DEFAULT = "rushikeshwagh43@gmail.com";

const TOPIC_LABELS = {
    basics: "SQL fundamentals & clauses",
    joins: "JOINs & relational combinations",
    aggregates: "GROUP BY, aggregates & HAVING",
    subqueries: "Subqueries & EXISTS / IN",
    window: "Window functions & OVER",
    cte: "CTEs & WITH",
    optimization: "Query tuning & patterns",
    indexes: "Indexes & access paths",
    nulls: "NULL handling & functions",
    dml_ddl: "DML / DDL basics",
    set_ops: "UNION / INTERSECT / EXCEPT",
};

function isValidEmail(s) {
    if (typeof s !== "string" || s.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function escapeHtml(t) {
    return String(t)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function buildHtml({ name, email, score, total, tier, topicsLines, summaryLine, timedOut }) {
    const safeName = escapeHtml(name);
    const tierLabel =
        tier === "pro"
            ? "Professional analyst level"
            : tier === "intermediate"
              ? "Intermediate"
              : tier === "novice"
                ? "Developing (between beginner & intermediate)"
                : "Beginner";

    return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<p>Hi ${safeName},</p>
<p><strong>Your SQL quiz score:</strong> ${score} / ${total}</p>
${timedOut ? "<p><em>Quiz ended automatically when the timer reached zero.</em></p>" : ""}
<p><strong>Level:</strong> ${escapeHtml(tierLabel)}</p>
<p>${escapeHtml(summaryLine)}</p>
${topicsLines.length ? `<p><strong>Topics to review:</strong></p><ul>${topicsLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` : ""}
<p style="margin-top:24px;color:#555;font-size:14px">— Rushikesh Wagh · Portfolio quiz<br/>
<a href="https://rushikeshwagh.vercel.app">rushikeshwagh.vercel.app</a></p>
<p style="font-size:12px;color:#888">Submitted as: ${escapeHtml(email)}</p>
</body></html>`;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "Portfolio Quiz <onboarding@resend.dev>";
    const ownerEmail = (process.env.QUIZ_OWNER_EMAIL || OWNER_DEFAULT).trim();

    if (!key) {
        return res.status(503).json({
            ok: false,
            error: "Email service not configured",
            code: "MISSING_RESEND",
        });
    }

    let body;
    try {
        body =
            typeof req.body === "object" && req.body !== null
                ? req.body
                : JSON.parse(typeof req.body === "string" ? req.body : "{}");
    } catch {
        return res.status(400).json({ ok: false, error: "Invalid JSON body" });
    }

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const score = Number(body.score);
    const total = Number(body.totalQuestions) || 10;
    const tier = typeof body.tier === "string" ? body.tier : "beginner";
    const wrongTopicKeys = Array.isArray(body.wrongTopicKeys) ? body.wrongTopicKeys : [];
    const timedOut = Boolean(body.timedOut);

    if (!name || !isValidEmail(email)) {
        return res.status(400).json({ ok: false, error: "Valid name and email required" });
    }
    if (!Number.isFinite(score) || score < 0 || score > total) {
        return res.status(400).json({ ok: false, error: "Invalid score" });
    }

    const uniqueTopics = [...new Set(wrongTopicKeys.filter((k) => typeof k === "string"))];
    const topicsLines = uniqueTopics.map((k) => TOPIC_LABELS[k] || k);

    const summaryLine =
        tier === "pro"
            ? "Outstanding — strong command of analytical SQL."
            : tier === "intermediate"
              ? "Solid foundation — you are close to professional analyst level. Keep drilling edge cases."
              : tier === "novice"
                ? "You are one step away from intermediate — review the topics below and try again."
                : "Keep practicing the areas below to move up to intermediate.";

    const html = buildHtml({
        name,
        email,
        score,
        total,
        tier,
        topicsLines,
        summaryLine,
        timedOut,
    });

    const subject = `Your SQL quiz: ${score}/${total}${timedOut ? " (timed out)" : ""} (${tier === "pro" ? "Pro" : tier === "intermediate" ? "Intermediate" : "Keep learning"})`;

    try {
        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: [email],
                bcc: [ownerEmail],
                subject,
                html,
            }),
        });

        const data = await r.json().catch(() => ({}));

        if (!r.ok) {
            console.error("Resend error", r.status, data);
            return res.status(502).json({
                ok: false,
                error: data.message || "Email provider rejected the request",
                code: "RESEND_ERROR",
            });
        }

        return res.status(200).json({ ok: true, id: data.id });
    } catch (e) {
        console.error(e);
        return res.status(502).json({ ok: false, error: "Failed to send email" });
    }
}
