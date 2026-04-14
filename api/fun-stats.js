/**
 * Vercel serverless: global Fun-tab visit counter (Upstash Redis REST).
 *
 * Env (from Upstash console → Redis → REST API):
 *   UPSTASH_REDIS_REST_URL   — e.g. https://xxxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — Bearer token (use primary token for INCR)
 *
 * GET  /api/fun-stats  → { ok: true, count: number }
 * POST /api/fun-stats  → increments and returns { ok: true, count: number }
 *
 * If Redis is not configured, GET returns { ok: true, count: null, unavailable: true }.
 */

const REDIS_KEY = "fun_tab_visits";

/**
 * @returns {{ base: string, token: string } | null}
 */
function redisConfig() {
    const base = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!base || !token) return null;
    return { base, token };
}

/**
 * @param {string} base
 * @param {string} token
 * @returns {Promise<number>}
 */
async function redisGetCount(base, token) {
    const r = await fetch(`${base}/get/${REDIS_KEY}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json().catch(() => ({}));
    if (j.error) throw new Error(j.error);
    const v = j.result;
    if (v == null) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/**
 * @param {string} base
 * @param {string} token
 * @returns {Promise<number>}
 */
async function redisIncr(base, token) {
    const r = await fetch(`${base}/incr/${REDIS_KEY}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json().catch(() => ({}));
    if (j.error) throw new Error(j.error);
    const n = Number(j.result);
    return Number.isFinite(n) ? n : 0;
}

export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");

    const cfg = redisConfig();
    if (!cfg) {
        if (req.method === "GET") {
            return res.status(200).json({ ok: true, count: null, unavailable: true });
        }
        return res.status(503).json({ ok: false, unavailable: true, error: "Counter not configured" });
    }

    try {
        if (req.method === "GET") {
            const count = await redisGetCount(cfg.base, cfg.token);
            return res.status(200).json({ ok: true, count });
        }
        if (req.method === "POST") {
            const count = await redisIncr(cfg.base, cfg.token);
            return res.status(200).json({ ok: true, count });
        }
        res.setHeader("Allow", "GET, POST");
        return res.status(405).json({ ok: false, error: "Method not allowed" });
    } catch (e) {
        console.error("fun-stats", e);
        return res.status(502).json({ ok: false, error: "Counter temporarily unavailable" });
    }
}
