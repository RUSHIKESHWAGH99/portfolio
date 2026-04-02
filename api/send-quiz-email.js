/**
 * Vercel serverless: notifies site owner of a quiz attempt via Resend.
 * Participant does not receive email (they download / share from the UI).
 *
 * Env:
 *   RESEND_API_KEY   — required
 *   RESEND_FROM      — verified domain sender
 *   QUIZ_OWNER_EMAIL — recipient; default rushikeshwagh43@gmail.com
 */

const OWNER_DEFAULT = "rushikeshwagh43@gmail.com";
const DEFAULT_RESEND_FROM = "Rushikesh Portfolio <onboarding@resend.dev>";
const SITE_URL = "https://rushikeshwagh.vercel.app";

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

/**
 * HTML body for the owner notification email.
 *
 * @param {object} p
 * @returns {string}
 */
function buildOwnerHtml({ name, email, score, total, tier, topicsLines, timedOut }) {
    const tierLabel =
        tier === "pro"
            ? "Professional analyst level"
            : tier === "intermediate"
              ? "Intermediate"
              : tier === "novice"
                ? "Developing (between beginner & intermediate)"
                : "Beginner";

    return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<p><strong>The Query Gauntlet</strong> — new attempt</p>
<p><strong>Name:</strong> ${escapeHtml(name)}<br/>
<strong>Email:</strong> ${escapeHtml(email)}<br/>
<strong>Score:</strong> ${score} / ${total}<br/>
<strong>Level:</strong> ${escapeHtml(tierLabel)}</p>
${timedOut ? "<p><em>Timer reached zero before submit.</em></p>" : ""}
${topicsLines.length ? `<p><strong>Topics missed (review areas):</strong></p><ul>${topicsLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` : "<p><em>No topic gaps (perfect or topics not tagged).</em></p>"}
<p style="margin-top:20px;font-size:14px;color:#555"><a href="${SITE_URL}/#fun">${SITE_URL}/#fun</a></p>
<p style="font-size:12px;color:#888">Reply-To is set to the participant if your client supports it.</p>
</body></html>`;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const key = process.env.RESEND_API_KEY;
    const from = (process.env.RESEND_FROM || DEFAULT_RESEND_FROM).trim();
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

    const html = buildOwnerHtml({
        name,
        email,
        score,
        total,
        tier,
        topicsLines,
        timedOut,
    });

    const subject = `[Query Gauntlet] ${name} — ${score}/${total} — ${email}`;

    try {
        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: [ownerEmail],
                reply_to: email,
                subject,
                html,
            }),
        });

        const data = await r.json().catch(() => ({}));

        if (!r.ok) {
            console.error("Resend error", r.status, data);
            return res.status(502).json({
                ok: false,
                error: "Email service temporarily unavailable",
                code: "RESEND_ERROR",
            });
        }

        return res.status(200).json({ ok: true, id: data.id });
    } catch (e) {
        console.error(e);
        return res.status(502).json({ ok: false, error: "Failed to send email" });
    }
}
