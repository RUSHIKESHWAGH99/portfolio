// ── Site views (tabs + hash) ─────────────────────────────────
const VIEW_IDS = ["home", "journey", "tools", "projects", "skills", "contact", "blogs", "fun"];

/**
 * Fills quiz name/email from ?name=&email= so shared links work.
 */
function applyQuizQueryPrefill() {
    const params = new URLSearchParams(window.location.search);
    const nameEl = document.getElementById("sql-quiz-name");
    const emailEl = document.getElementById("sql-quiz-email");
    if (!nameEl || !emailEl) return;
    const qn = params.get("name");
    const qe = params.get("email");
    if (qn != null && String(qn).trim() !== "") nameEl.value = String(qn).trim().slice(0, 120);
    if (qe != null && String(qe).trim() !== "") emailEl.value = String(qe).trim().slice(0, 200);
}

function showView(name) {
    const n = VIEW_IDS.includes(name) ? name : "home";
    VIEW_IDS.forEach((id) => {
        const el = document.getElementById(`view-${id}`);
        if (!el) return;
        if (id === n) {
            el.removeAttribute("hidden");
        } else {
            el.setAttribute("hidden", "");
        }
    });
    document.querySelectorAll(".site-tab").forEach((tab) => {
        const on = tab.dataset.view === n;
        tab.classList.toggle("active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    // Scroll the active tab into view inside the scrollable tab strip
    const activeTab = document.querySelector(`.site-tab[data-view="${n}"]`);
    activeTab?.scrollIntoView({ block: "nearest", inline: "center" });
    // Keep ?query= params (e.g. ?name=&email=); a bare "#tab" can drop the search string in some browsers.
    history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${n}`
    );
    window.scrollTo({ top: 0, behavior: "instant" });
    // Fun tab lives in a view that starts display:none — reveal animations may never run; force visible.
    if (n === "fun") {
        requestAnimationFrame(() => {
            document.querySelectorAll("#view-fun .reveal").forEach((el) => el.classList.add("visible"));
            applyQuizQueryPrefill();
        });
        void refreshFunVisitBadge();
    }
}

/** Session key: one Fun-tab visit increment per browser session. */
const FUN_VISIT_SESSION_KEY = "fun_tab_visit_recorded_v1";

/**
 * Formats the global Fun-tab visit count for the header badge.
 *
 * @param {number} n
 * @returns {string}
 */
function formatFunVisitLabel(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M visits`;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k visits`;
    return `${n.toLocaleString("en-US")} ${n === 1 ? "visit" : "visits"}`;
}

/**
 * Loads the shared visit counter beside "Fun" and records this session once.
 */
async function refreshFunVisitBadge() {
    const el = document.getElementById("fun-visit-count");
    if (!el) return;

    try {
        const r = await fetch(new URL("/api/fun-stats", window.location.origin));
        const data = await r.json().catch(() => ({}));

        if (!data.ok || data.unavailable) {
            el.hidden = true;
            return;
        }

        if (typeof data.count === "number") {
            el.textContent = formatFunVisitLabel(data.count);
            el.hidden = false;
        }

        if (sessionStorage.getItem(FUN_VISIT_SESSION_KEY)) return;

        sessionStorage.setItem(FUN_VISIT_SESSION_KEY, "1");
        const r2 = await fetch(new URL("/api/fun-stats", window.location.origin), { method: "POST" });
        const data2 = await r2.json().catch(() => ({}));
        if (data2.ok && typeof data2.count === "number") {
            el.textContent = formatFunVisitLabel(data2.count);
            el.hidden = false;
        }
    } catch {
        el.hidden = true;
    }
}

function initViews() {
    const hash = (location.hash || "#home").replace(/^#/, "");
    showView(hash || "home");

    window.addEventListener("hashchange", () => {
        showView((location.hash || "#home").replace(/^#/, "") || "home");
    });

    document.querySelectorAll(".site-tab").forEach((tab) => {
        tab.addEventListener("click", () => showView(tab.dataset.view || "home"));
    });

    document.querySelectorAll("[data-view]").forEach((el) => {
        el.addEventListener("click", (e) => {
            const v = el.dataset.view;
            const href = el.getAttribute("href") || "";
            if (!v || href.startsWith("http")) return;
            e.preventDefault();
            showView(v);
            document.getElementById("nav-mobile")?.classList.remove("open");
        });
    });
}

// ── Scroll reveal ────────────────────────────────────────────
const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
            }
        });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);

function initReveal() {
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

// ── Navbar scroll effect ────────────────────────────────────
function initNavScroll() {
    const nav = document.getElementById("nav");
    if (!nav) return;
    window.addEventListener("scroll", () => {
        nav.classList.toggle("scrolled", window.scrollY > 20);
    });
}

// ── Mobile nav toggle ───────────────────────────────────────
function initMobileNav() {
    const toggle = document.getElementById("nav-toggle");
    const mobileNav = document.getElementById("nav-mobile");
    if (!toggle || !mobileNav) return;
    toggle.addEventListener("click", () => {
        mobileNav.classList.toggle("open");
    });
    mobileNav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => mobileNav.classList.remove("open"));
    });
}

// ── Stat counter animation ──────────────────────────────────
const countObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const el = entry.target;
            const target = parseInt(el.dataset.count, 10);
            const duration = 1200;
            const start = performance.now();

            function tick(now) {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                el.textContent = String(Math.round(eased * target));
                if (progress < 1) requestAnimationFrame(tick);
            }

            requestAnimationFrame(tick);
            countObserver.unobserve(el);
        });
    },
    { threshold: 0.4 }
);

function initStats() {
    document.querySelectorAll(".stat-number").forEach((el) => countObserver.observe(el));
}

// ── A/B calculator (two-proportion z-test) ──────────────────
function erf(x) {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y =
        1 -
        (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
    return sign * y;
}

function normalCDF(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}

function initABCalculator() {
    const btn = document.getElementById("ab-calc");
    const out = document.getElementById("ab-out");
    const err = document.getElementById("ab-err");
    if (!btn || !out || !err) return;

    btn.addEventListener("click", () => {
        err.hidden = true;
        out.hidden = true;

        const visA = Number(document.getElementById("ab-vis-a")?.value);
        const convA = Number(document.getElementById("ab-conv-a")?.value);
        const visB = Number(document.getElementById("ab-vis-b")?.value);
        const convB = Number(document.getElementById("ab-conv-b")?.value);
        const alpha = Number(document.getElementById("ab-alpha")?.value || "0.05");

        if (
            [visA, visB, convA, convB].some((n) => Number.isNaN(n)) ||
            visA <= 0 ||
            visB <= 0 ||
            convA < 0 ||
            convB < 0 ||
            convA > visA ||
            convB > visB
        ) {
            err.textContent =
                "Check inputs: visitors must be positive, conversions between 0 and visitors.";
            err.hidden = false;
            return;
        }

        const p1 = convA / visA;
        const p2 = convB / visB;
        const pPool = (convA + convB) / (visA + visB);
        const se = Math.sqrt(pPool * (1 - pPool) * (1 / visA + 1 / visB));
        if (se === 0) {
            err.textContent = "Cannot compute standard error (identical or empty variation).";
            err.hidden = false;
            return;
        }
        const z = (p2 - p1) / se;
        const pVal = 2 * (1 - normalCDF(Math.abs(z)));
        const zCrit = alpha === 0.01 ? 2.576 : alpha === 0.05 ? 1.96 : 1.645;
        const significant = pVal < alpha;

        const lift = p1 > 0 ? ((p2 - p1) / p1) * 100 : null;

        out.innerHTML = `
            <dl>
                <dt>Rate A</dt><dd>${(p1 * 100).toFixed(3)}%</dd>
                <dt>Rate B</dt><dd>${(p2 * 100).toFixed(3)}%</dd>
                <dt>Difference (B − A)</dt><dd>${((p2 - p1) * 100).toFixed(3)} pp</dd>
                ${lift != null ? `<dt>Relative lift (vs A)</dt><dd>${lift.toFixed(2)}%</dd>` : ""}
                <dt>z-statistic</dt><dd>${z.toFixed(4)}</dd>
                <dt>Two-sided p-value</dt><dd>${pVal < 0.0001 ? "< 0.0001" : pVal.toFixed(4)}</dd>
                <dt>Significant at α = ${alpha}?</dt><dd>${
            significant ? "Yes — p &lt; α (normal approximation)" : "No — p ≥ α (normal approximation)"
        } (|z| &gt; ${zCrit} is an equivalent rule for large samples)</dd>
            </dl>
            <p style="margin-top:14px;color:var(--text-dim);font-size:0.82rem">Educational use only — confirm with your org’s stats practice and sample design.</p>`;
        out.hidden = false;
    });
}

// ── Cohort CSV ────────────────────────────────────────────────
function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter((line) => line.length > 0);
    return lines.map((line) => {
        const row = [];
        let cur = "";
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
                inQ = !inQ;
                continue;
            }
            if (c === "," && !inQ) {
                row.push(cur.trim());
                cur = "";
                continue;
            }
            cur += c;
        }
        row.push(cur.trim());
        return row;
    });
}

function initCohortTool() {
    const input = document.getElementById("cohort-file");
    const out = document.getElementById("cohort-out");
    const err = document.getElementById("cohort-err");
    if (!input || !out || !err) return;

    input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        err.hidden = true;
        out.innerHTML = "";
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result || "");
                const rows = parseCSV(text);
                if (rows.length < 2) {
                    throw new Error("CSV needs a header row and at least one data row.");
                }
                const header = rows[0];
                const dataRows = rows.slice(1);
                if (header.length < 3) {
                    throw new Error("Need a cohort column plus at least two period columns.");
                }

                const numeric = dataRows.map((r) =>
                    r.map((cell, i) => {
                        if (i === 0) return cell;
                        const v = parseFloat(cell);
                        if (Number.isNaN(v)) throw new Error(`Non-numeric value: ${cell}`);
                        return v;
                    })
                );

                let maxVal = 0;
                numeric.forEach((row) => {
                    row.slice(1).forEach((v) => {
                        maxVal = Math.max(maxVal, v);
                    });
                });
                const isFraction = maxVal <= 1.5;
                const colMax = header.map((_, j) => {
                    if (j === 0) return 1;
                    return Math.max(...numeric.map((row) => Number(row[j])), 1e-9);
                });

                let html = '<div class="cohort-table-wrap"><table class="cohort-table"><thead><tr>';
                header.forEach((h) => {
                    html += `<th>${escapeHtml(h)}</th>`;
                });
                html += "</tr></thead><tbody>";

                numeric.forEach((r) => {
                    html += "<tr>";
                    r.forEach((cell, j) => {
                        if (j === 0) {
                            html += `<td>${escapeHtml(String(cell))}</td>`;
                            return;
                        }
                        const v = Number(cell);
                        let pct;
                        let display;
                        if (isFraction) {
                            pct = v * 100;
                            display = `${pct.toFixed(1)}%`;
                        } else {
                            display = String(v);
                            pct = (v / colMax[j]) * 100;
                        }
                        pct = Math.min(100, Math.max(0, pct));
                        const alpha = 0.12 + (pct / 100) * 0.38;
                        html += `<td style="background:rgba(124,106,255,${alpha});color:#e8e8f0">${escapeHtml(
                            display
                        )}</td>`;
                    });
                    html += "</tr>";
                });
                html += "</tbody></table></div>";
                out.innerHTML = html;
            } catch (e) {
                err.textContent = e instanceof Error ? e.message : "Could not parse CSV.";
                err.hidden = false;
            }
        };
        reader.readAsText(file);
    });
}

function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ── SQL format + highlight + static hints ─────────────────────

const SQL_HINTS = {
    SELECT:          "Lists columns or expressions to return in the result set.",
    FROM:            "Names the primary table (or subquery) rows are read from.",
    WHERE:           "Filters rows before aggregation; conditions use column values.",
    JOIN:            "Combines rows from another table using a join condition.",
    "INNER JOIN":    "Keeps only rows that match on both sides of the join.",
    "LEFT JOIN":     "Keeps all rows from the left table; fills gaps from the right with NULL.",
    "RIGHT JOIN":    "Keeps all rows from the right table; opposite bias vs LEFT JOIN.",
    "FULL JOIN":     "Keeps rows from either side when a match exists on either.",
    "CROSS JOIN":    "Cartesian product — every left row paired with every right row.",
    ON:              "Specifies how joined tables relate (e.g. keys that must match).",
    AND:             "Adds another required condition (logical AND).",
    OR:              "Alternative condition — often needs parentheses to avoid ambiguity.",
    "GROUP BY":      "Buckets rows before aggregates (SUM, COUNT, …) are applied.",
    HAVING:          "Filters groups after aggregation (similar to WHERE for aggregates).",
    "ORDER BY":      "Sorts rows — final result set, or inside OVER before the window frame is applied.",
    LIMIT:           "Caps how many rows are returned (syntax varies slightly by engine).",
    OFFSET:          "Skips rows before applying LIMIT (pagination).",
    UNION:           "Stacks results from two queries; column counts/types should align.",
    "UNION ALL":     "Like UNION but keeps duplicate rows.",
    WITH:            "Defines a common table expression (CTE) — a reusable named subquery.",
    OVER:            "Opens a window-function frame — works with PARTITION BY / ORDER BY.",
    "PARTITION BY":  "Divides rows into groups within a window function frame.",
    ROWS:            "ROWS frame: counts physical row positions relative to the current row.",
    RANGE:           "RANGE frame: groups rows tied on ORDER BY values (handles ties vs ROWS).",
    "ROWS BETWEEN":  "Defines a ROWS window frame: ROWS BETWEEN … PRECEDING/FOLLOWING AND …",
    "RANGE BETWEEN": "Defines a RANGE window frame: RANGE BETWEEN … AND …",
    UNBOUNDED:      "Frame boundary: UNBOUNDED PRECEDING / UNBOUNDED FOLLOWING (partition start/end).",
    "UNBOUNDED PRECEDING": "Frame starts at the first row of the partition (or peer group).",
    "UNBOUNDED FOLLOWING": "Frame extends through the last row of the partition (or peer group).",
    PRECEDING:       "N PRECEDING — N rows or units before the current row in the frame.",
    FOLLOWING:       "N FOLLOWING — N rows or units after the current row in the frame.",
    "CURRENT ROW":   "CURRENT ROW — frame boundary at the current row.",
    WINDOW:          "Names a reusable window spec: WINDOW w AS (PARTITION BY … ORDER BY …).",
    FILTER:          "FILTER (WHERE …) — restricts which rows feed an aggregate or window function.",
    QUALIFY:         "Filters rows after window functions (e.g. Snowflake: QUALIFY rn = 1).",
    RESPECT:         "RESPECT NULLS — include NULLs in ordering for LEAD/LAG-style navigation.",
    IGNORE:          "IGNORE NULLS — skip NULLs when stepping with LEAD/LAG (engine-dependent).",
    DISTINCT:        "Removes duplicate rows from the result set.",
    CASE:            "Conditional expression: CASE WHEN … THEN … ELSE … END.",
};

// Clause-starting keywords (longer patterns first so GROUP BY beats BY)
const SQL_CLAUSE_KW = [
    "GROUP BY", "ORDER BY", "PARTITION BY",
    "UNBOUNDED PRECEDING", "UNBOUNDED FOLLOWING",
    "ROWS BETWEEN", "RANGE BETWEEN", "CURRENT ROW",
    "OVER", "WINDOW",
    "LEFT OUTER JOIN", "RIGHT OUTER JOIN", "FULL OUTER JOIN",
    "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN", "CROSS JOIN",
    "UNION ALL", "UNION", "INTERSECT", "EXCEPT",
    "FROM", "WHERE", "HAVING", "SELECT",
    "LIMIT", "OFFSET", "WITH",
    "INSERT INTO", "UPDATE", "SET", "DELETE FROM",
];

// Sub-clause continuations → indented
const SQL_INDENT_KW = ["AND", "OR", "ON"];

// All keywords recognised for syntax highlighting
const SQL_KW_SET = new Set([
    "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
    "FULL", "CROSS", "ON", "AND", "OR", "NOT", "IN", "EXISTS", "BETWEEN",
    "LIKE", "ILIKE", "IS", "NULL", "AS", "CASE", "WHEN", "THEN", "ELSE", "END",
    "GROUP", "BY", "HAVING", "ORDER", "LIMIT", "OFFSET", "UNION", "ALL",
    "DISTINCT", "TOP", "INTO", "VALUES", "INSERT", "UPDATE", "DELETE",
    "CREATE", "DROP", "ALTER", "TABLE", "VIEW", "INDEX", "WITH",
    "OVER", "PARTITION", "ROWS", "RANGE", "UNBOUNDED", "PRECEDING",
    "FOLLOWING", "CURRENT", "ROW", "WINDOW", "FILTER", "QUALIFY",
    "RESPECT", "IGNORE", "ASC", "DESC", "NULLS", "FIRST", "LAST",
    "SET", "RETURNING", "EXCEPT", "INTERSECT", "RECURSIVE",
    "TRUE", "FALSE",
    // aggregate / window / scalar functions
    "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "CAST",
    "CONVERT", "EXTRACT", "DATE_TRUNC", "DATE_PART", "NOW", "CURRENT_DATE",
    "ROW_NUMBER", "RANK", "DENSE_RANK", "PERCENT_RANK", "CUME_DIST",
    "LAG", "LEAD", "NTILE",
    "FIRST_VALUE", "LAST_VALUE", "NTH_VALUE",
    "CONCAT", "LENGTH", "LOWER", "UPPER", "TRIM", "LTRIM", "RTRIM",
    "SUBSTRING", "REPLACE", "SPLIT_PART", "REGEXP_REPLACE",
    "ROUND", "FLOOR", "CEIL", "CEILING", "ABS", "MOD", "POWER", "SQRT",
    "IIF", "IF", "IFNULL", "NVL", "DECODE", "GREATEST", "LEAST",
    "TO_CHAR", "TO_DATE", "TO_TIMESTAMP", "DATE_ADD", "DATE_DIFF",
    "ARRAY_AGG", "STRING_AGG", "LISTAGG", "JSON_AGG",
    "GENERATE_SERIES",
]);

/** Split `s` by commas at paren depth 0 (so f(a, b) stays whole). */
function splitTopLevelCommas(s) {
    const parts = [];
    let depth = 0;
    let cur = "";
    for (const ch of s) {
        if (ch === "(" || ch === "[") { depth++; cur += ch; }
        else if (ch === ")" || ch === "]") { depth--; cur += ch; }
        else if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; }
        else { cur += ch; }
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
}

/**
 * Format SQL with proper clause indentation.
 * Returns plain text (no HTML) — suitable for clipboard copy.
 */
function formatSql(sql) {
    // Collapse all runs of whitespace to a single space
    let s = sql.replace(/\s+/g, " ").trim();

    // Place clause-starting keywords on their own line
    for (const kw of SQL_CLAUSE_KW) {
        const pat = kw.replace(/\s+/g, "\\s+");
        s = s.replace(new RegExp(`\\b${pat}\\b`, "gi"), `\n${kw} `);
    }

    // Indent sub-clause continuations
    for (const kw of SQL_INDENT_KW) {
        s = s.replace(new RegExp(`\\b${kw}\\b`, "gi"), `\n    ${kw} `);
    }

    // Split into lines, trim trailing spaces, drop blanks
    const lines = s
        .split("\n")
        .map((l) => l.trimEnd())
        .filter(Boolean);

    // Expand SELECT column list — one column per indented line
    const out = [];
    for (const line of lines) {
        const trimmed = line.trimStart();
        if (/^SELECT\s+/i.test(trimmed)) {
            const rest = trimmed.replace(/^SELECT\s+/i, "").trim();
            if (rest) {
                const cols = splitTopLevelCommas(rest);
                if (cols.length > 1) {
                    out.push("SELECT");
                    cols.forEach((col, idx) => {
                        out.push(`    ${col}${idx < cols.length - 1 ? "," : ""}`);
                    });
                    continue;
                }
            }
        }
        // Preserve leading indent on AND/OR/ON lines; strip others
        out.push(line.startsWith("    ") ? line : trimmed);
    }

    return out.join("\n").trim();
}

/**
 * Build HTML with syntax-highlight spans from already-formatted plain SQL.
 * Operates character-by-character so strings/comments are never miscoloured.
 */
function highlightSql(formatted) {
    let html = "";
    let i = 0;
    const s = formatted;

    while (i < s.length) {
        // Preserve newlines and spaces as-is
        if (s[i] === "\n") { html += "\n"; i++; continue; }
        if (s[i] === " " || s[i] === "\t") {
            let j = i;
            while (j < s.length && (s[j] === " " || s[j] === "\t")) j++;
            html += s.slice(i, j);
            i = j;
            continue;
        }

        // Line comment  -- ...
        if (s[i] === "-" && s[i + 1] === "-") {
            let j = i;
            while (j < s.length && s[j] !== "\n") j++;
            html += `<span class="sql-cmt">${escapeHtml(s.slice(i, j))}</span>`;
            i = j;
            continue;
        }

        // Block comment  /* ... */
        if (s[i] === "/" && s[i + 1] === "*") {
            let j = i + 2;
            while (j < s.length - 1 && !(s[j] === "*" && s[j + 1] === "/")) j++;
            j += 2;
            html += `<span class="sql-cmt">${escapeHtml(s.slice(i, j))}</span>`;
            i = j;
            continue;
        }

        // Single-quoted string  '...' ('' = escaped quote)
        if (s[i] === "'") {
            let j = i + 1;
            while (j < s.length) {
                if (s[j] === "'") {
                    if (s[j + 1] === "'") { j += 2; continue; }
                    break;
                }
                j++;
            }
            j++;
            html += `<span class="sql-str">${escapeHtml(s.slice(i, j))}</span>`;
            i = j;
            continue;
        }

        // Quoted identifier  "..." or `...`
        if (s[i] === '"' || s[i] === "`") {
            const close = s[i];
            let j = i + 1;
            while (j < s.length && s[j] !== close) j++;
            j++;
            html += `<span class="sql-ident">${escapeHtml(s.slice(i, j))}</span>`;
            i = j;
            continue;
        }

        // Number (integer or decimal)
        if (/[0-9]/.test(s[i])) {
            let j = i;
            while (j < s.length && /[0-9.]/.test(s[j])) j++;
            html += `<span class="sql-num">${escapeHtml(s.slice(i, j))}</span>`;
            i = j;
            continue;
        }

        // Word → keyword, function, or plain identifier
        if (/[a-zA-Z_]/.test(s[i])) {
            let j = i;
            while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
            const word = s.slice(i, j);
            const upper = word.toUpperCase();
            // Peek ahead past spaces to see if '(' follows → function call
            let k = j;
            while (k < s.length && s[k] === " ") k++;
            const isFunc = s[k] === "(";
            if (SQL_KW_SET.has(upper)) {
                const cls = isFunc ? "sql-fn" : "sql-kw";
                html += `<span class="${cls}">${escapeHtml(word)}</span>`;
            } else {
                html += escapeHtml(word);
            }
            i = j;
            continue;
        }

        // Everything else (operators, punctuation, semicolons)
        html += escapeHtml(s[i]);
        i++;
    }

    return html;
}

/** Collect hint keys present in the formatted SQL. */
function collectSqlHints(formatted) {
    const out = [];
    for (const kw of Object.keys(SQL_HINTS)) {
        const pat = `\\b${kw.replace(/\s+/g, "\\s+")}\\b`;
        if (new RegExp(pat, "i").test(formatted)) out.push(kw);
    }
    return out;
}

function initSqlTool() {
    const ta    = document.getElementById("sql-in");
    const pre   = document.getElementById("sql-out");
    const fmt   = document.getElementById("sql-format");
    const cpy   = document.getElementById("sql-copy");
    const hints = document.getElementById("sql-hint-list");
    if (!ta || !pre || !fmt || !hints) return;

    function run() {
        const formatted = formatSql(ta.value);
        // innerHTML for colours; textContent (used by copy) strips tags automatically
        pre.innerHTML = highlightSql(formatted);
        const keys = collectSqlHints(formatted);
        hints.innerHTML = keys.length
            ? keys
                  .map((k) => `<li><code>${escapeHtml(k)}</code> — ${SQL_HINTS[k] || ""}</li>`)
                  .join("")
            : '<li style="border:none">No major keywords detected — paste a fuller query.</li>';
    }

    fmt.addEventListener("click", run);
    cpy.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(pre.textContent || "");
        } catch { /* ignore */ }
    });
    run();
}

// ── Sample size calculator ────────────────────────────────────
function zFromAlpha(alpha) {
    const m = { 0.10: 1.6449, 0.05: 1.9600, 0.01: 2.5758 };
    return m[alpha] || 1.96;
}
function zFromPower(power) {
    const m = { 0.80: 0.8416, 0.90: 1.2816, 0.95: 1.6449 };
    return m[power] || 0.8416;
}

function initSampleSize() {
    const btn = document.getElementById("ss-calc");
    const out = document.getElementById("ss-out");
    const err = document.getElementById("ss-err");
    if (!btn || !out || !err) return;

    btn.addEventListener("click", () => {
        err.hidden = true;
        out.hidden = true;

        const baseline = Number(document.getElementById("ss-baseline")?.value) / 100;
        const mdeRel   = Number(document.getElementById("ss-mde")?.value) / 100;
        const power    = Number(document.getElementById("ss-power")?.value);
        const alpha    = Number(document.getElementById("ss-alpha")?.value);

        if (baseline <= 0 || baseline >= 1 || mdeRel <= 0) {
            err.textContent = "Baseline must be 0-100 % and MDE must be positive.";
            err.hidden = false;
            return;
        }

        const p1 = baseline;
        const p2 = baseline * (1 + mdeRel);
        if (p2 >= 1) {
            err.textContent = "Variant rate (baseline + MDE) exceeds 100 %. Reduce MDE.";
            err.hidden = false;
            return;
        }

        const za = zFromAlpha(alpha);
        const zb = zFromPower(power);
        const n = Math.ceil(
            Math.pow(za * Math.sqrt(2 * baseline * (1 - baseline)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2) /
            Math.pow(p2 - p1, 2)
        );

        const totalDays7  = Math.ceil((n * 2) / 1000);
        const totalDays14 = Math.ceil((n * 2) / 500);

        out.innerHTML = `
            <dl>
                <dt>Baseline rate</dt><dd>${(p1 * 100).toFixed(2)}%</dd>
                <dt>Variant rate (expected)</dt><dd>${(p2 * 100).toFixed(2)}%</dd>
                <dt>Absolute effect</dt><dd>${((p2 - p1) * 100).toFixed(2)} pp</dd>
                <dt>Sample per group</dt><dd><strong>${n.toLocaleString()}</strong></dd>
                <dt>Total users (both groups)</dt><dd>${(n * 2).toLocaleString()}</dd>
                <dt>At 1k users/day</dt><dd>~${totalDays7} days</dd>
                <dt>At 500 users/day</dt><dd>~${totalDays14} days</dd>
            </dl>
            <p style="margin-top:14px;color:var(--text-dim);font-size:0.82rem">Two-sided test, equal allocation, normal approximation.</p>`;
        out.hidden = false;
    });
}

// ── JSON formatter + CSV download ────────────────────────────

/** Syntax-highlight already-formatted JSON string → HTML. */
function highlightJson(str) {
    return str.replace(
        /("(?:\\.|[^"\\])*")\s*:/g,
        '<span class="json-key">$1</span>:'
    ).replace(
        /:\s*("(?:\\.|[^"\\])*")/g,
        ': <span class="json-val json-str">$1</span>'
    ).replace(
        /:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g,
        ': <span class="json-val json-num">$1</span>'
    ).replace(
        /:\s*(true|false)\b/g,
        ': <span class="json-val json-bool">$1</span>'
    ).replace(
        /:\s*(null)\b/g,
        ': <span class="json-val json-null">$1</span>'
    ).replace(
        /^(\s*"(?:\\.|[^"\\])*")(?!:)/gm,
        '<span class="json-val json-str">$1</span>'
    );
}

/** Flatten nested objects using dot-notation keys for CSV export. */
function flattenObj(obj, prefix) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
            Object.assign(out, flattenObj(v, key));
        } else {
            out[key] = v;
        }
    }
    return out;
}

function jsonArrayToCsv(arr) {
    const flat = arr.map((row) => flattenObj(row, ""));
    const keys = [...new Set(flat.flatMap(Object.keys))];
    const esc = (v) => {
        const s = v == null ? "" : String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    };
    const lines = [keys.map(esc).join(",")];
    for (const row of flat) {
        lines.push(keys.map((k) => esc(row[k])).join(","));
    }
    return lines.join("\n");
}

function initJsonFormatter() {
    const ta   = document.getElementById("json-in");
    const pre  = document.getElementById("json-out");
    const btn  = document.getElementById("json-format");
    const cpy  = document.getElementById("json-copy");
    const dl   = document.getElementById("json-csv-dl");
    const err  = document.getElementById("json-err");
    if (!ta || !pre || !btn) return;

    let lastParsed = null;

    function run() {
        if (err) err.hidden = true;
        lastParsed = null;
        const raw = ta.value.trim();
        if (!raw) { pre.innerHTML = ""; return; }
        try {
            const parsed = JSON.parse(raw);
            lastParsed = parsed;
            const formatted = JSON.stringify(parsed, null, 2);
            pre.innerHTML = highlightJson(escapeHtml(formatted));
        } catch (e) {
            pre.innerHTML = "";
            if (err) {
                err.textContent = e instanceof Error ? e.message : "Invalid JSON.";
                err.hidden = false;
            }
        }
    }

    btn.addEventListener("click", run);

    if (cpy) {
        cpy.addEventListener("click", async () => {
            try { await navigator.clipboard.writeText(pre.textContent || ""); } catch { /* ignore */ }
        });
    }

    if (dl) {
        dl.addEventListener("click", () => {
            if (err) err.hidden = true;
            if (!lastParsed) {
                run();
                if (!lastParsed) return;
            }
            let arr = lastParsed;
            if (!Array.isArray(arr)) arr = [arr];
            if (!arr.length || typeof arr[0] !== "object") {
                if (err) {
                    err.textContent = "CSV download requires a JSON array of objects.";
                    err.hidden = false;
                }
                return;
            }
            const csv = jsonArrayToCsv(arr);
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "data.csv";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
}

// ── Theme toggle (light / dark) ──────────────────────────────
function initTheme() {
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    const stored = localStorage.getItem("theme");
    if (stored === "light") document.documentElement.setAttribute("data-theme", "light");

    toggle.addEventListener("click", () => {
        const isLight = document.documentElement.getAttribute("data-theme") === "light";
        if (isLight) {
            document.documentElement.removeAttribute("data-theme");
            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.setAttribute("data-theme", "light");
            localStorage.setItem("theme", "light");
        }
    });
}

// ── SQL quiz (Fun tab) ───────────────────────────────────────
/** Total seconds allowed for all 10 questions. */
const SQL_QUIZ_TIME_SEC = 600;

/** Portfolio page shared on LinkedIn (Fun tab). */
const QUIZ_SHARE_URL = "https://rushikeshwagh.vercel.app/#fun";

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Returns a random subset without repeating items.
 *
 * @template T
 * @param {T[]} items
 * @param {number} count
 * @returns {T[]}
 */
function pickRandomItems(items, count) {
    return shuffleInPlace([...items]).slice(0, Math.max(0, count));
}

/**
 * Formats quiz question text so SQL reads one clause per line when it was a single line.
 *
 * @param {string} raw
 * @param {boolean} isPractical
 * @returns {string}
 */
function formatSqlQuestionForDisplay(raw, isPractical) {
    const normalized = raw.replace(/\r\n/g, "\n").trim();
    if (/\n/.test(normalized)) {
        return normalized
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .join("\n");
    }
    if (!isPractical) return raw;
    const oneLine = normalized.replace(/\s+/g, " ").trim();
    if (!/\bSELECT\b/i.test(oneLine)) return raw;
    return oneLine
        .replace(/\s+FROM\s+/gi, "\nFROM ")
        .replace(/\s+WHERE\s+/gi, "\nWHERE ")
        .replace(/\s+(LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN|JOIN)\s+/gi, "\n$1 ")
        .replace(/\s+ON\s+/gi, "\nON ")
        .replace(/\s+GROUP\s+BY\s+/gi, "\nGROUP BY ")
        .replace(/\s+HAVING\s+/gi, "\nHAVING ")
        .replace(/\s+ORDER\s+BY\s+/gi, "\nORDER BY ")
        .replace(/\s+LIMIT\s+/gi, "\nLIMIT ")
        .replace(/\s+UNION\s+/gi, "\nUNION ")
        .trim();
}

/**
 * Adds a short congratulations burst on top of a game card.
 *
 * @param {HTMLElement | null} cardEl
 * @param {{ pieces?: number, durationMs?: number }} [options]
 */
function triggerFunCelebration(cardEl, options) {
    if (!cardEl) return;

    const pieces = options?.pieces ?? 28;
    const durationMs = options?.durationMs ?? 2100;
    const colors = ["#7c6aff", "#9d8fff", "#ffd76a", "#5eead4", "#ff8fab"];

    const activeTimerId = Number(cardEl.dataset.celebrationTimerId || 0);
    if (activeTimerId) window.clearTimeout(activeTimerId);

    const existingBurst = cardEl.querySelector(".fun-win-burst");
    if (existingBurst) existingBurst.remove();

    cardEl.classList.add("is-celebrating");

    const burst = document.createElement("div");
    burst.className = "fun-win-burst";

    for (let idx = 0; idx < pieces; idx++) {
        const piece = document.createElement("span");
        piece.className = "fun-win-confetti";
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = colors[idx % colors.length];
        piece.style.animationDelay = `${Math.floor(Math.random() * 180)}ms`;
        piece.style.setProperty("--burst-x", `${Math.floor(Math.random() * 120) - 60}px`);
        burst.appendChild(piece);
    }

    cardEl.appendChild(burst);

    const timerId = window.setTimeout(() => {
        burst.remove();
        cardEl.classList.remove("is-celebrating");
        delete cardEl.dataset.celebrationTimerId;
    }, durationMs);

    cardEl.dataset.celebrationTimerId = String(timerId);
}

/**
 * Wires the 10-question SQL MCQ flow: registration, play, results, email via API.
 */
function initSqlQuiz() {
    const app = document.getElementById("sql-quiz-app");
    if (!app) return;
    const quizCard = document.getElementById("querygauntlet-card");

    const regPanel = document.getElementById("sql-quiz-reg");
    const playPanel = document.getElementById("sql-quiz-play");
    const resPanel = document.getElementById("sql-quiz-results");
    const form = document.getElementById("sql-quiz-reg-form");
    const loadErr = document.getElementById("sql-quiz-load-err");
    const qWrap = document.getElementById("sql-quiz-q-wrap");
    const progLabel = document.getElementById("sql-quiz-progress-label");
    const timerEl = document.getElementById("sql-quiz-timer");
    const btnPrev = document.getElementById("sql-quiz-prev");
    const btnNext = document.getElementById("sql-quiz-next");
    const btnRetry = document.getElementById("sql-quiz-retry");
    const btnStart = document.getElementById("sql-quiz-start");

    if (
        !regPanel ||
        !playPanel ||
        !resPanel ||
        !form ||
        !loadErr ||
        !qWrap ||
        !progLabel ||
        !btnPrev ||
        !btnNext ||
        !btnRetry ||
        !btnStart
    ) {
        console.warn("SQL quiz: missing required DOM nodes");
        return;
    }
    const proCard = document.getElementById("sql-quiz-pro-card");
    const resultStandard = document.getElementById("sql-quiz-result-standard");
    const scoreLine = document.getElementById("sql-quiz-score-line");
    const tierMsg = document.getElementById("sql-quiz-tier-msg");
    const topicsBlock = document.getElementById("sql-quiz-topics-block");
    const topicsList = document.getElementById("sql-quiz-topics-list");
    const emailStatus = document.getElementById("sql-quiz-email-status");
    const proScoreEl = document.getElementById("sql-quiz-pro-score");
    const resultHeading = document.getElementById("sql-quiz-result-heading");
    const btnDownload = document.getElementById("sql-quiz-download");
    const btnLinkedIn = document.getElementById("sql-quiz-linkedin");
    const btnCopyBlurb = document.getElementById("sql-quiz-copy-blurb");
    const copyHint = document.getElementById("sql-quiz-copy-hint");

    /** @type {null | { name: string, email: string, score: number, tier: string, topicLines: string[], timedOut: boolean, atIso: string }} */
    let lastScoreSnapshot = null;

    let pool             = null;   // flat array of all questions
    let theoreticalPool  = [];     // type === "theoretical"
    let practicalPool    = [];     // type === "practical"
    let topicLabels      = {};
    let selected         = [];
    let answers = [];
    let qIndex = 0;
    let participantName = "";
    let participantEmail = "";
    let quizCompleted = false;
    let timerId = null;
    let secondsLeft = 0;
    let endedByTimer = false;

    function stopQuizTimer() {
        if (timerId !== null) {
            window.clearInterval(timerId);
            timerId = null;
        }
    }

    function updateTimerDisplay() {
        if (!timerEl) return;
        const m = Math.floor(Math.max(0, secondsLeft) / 60);
        const s = Math.max(0, secondsLeft) % 60;
        timerEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
        timerEl.classList.toggle("is-low", secondsLeft <= 60 && secondsLeft > 0);
        timerEl.classList.toggle("is-critical", secondsLeft <= 30 && secondsLeft > 0);
    }

    function startQuizTimer() {
        stopQuizTimer();
        endedByTimer = false;
        secondsLeft = SQL_QUIZ_TIME_SEC;
        updateTimerDisplay();
        timerId = window.setInterval(() => {
            secondsLeft -= 1;
            updateTimerDisplay();
            if (secondsLeft <= 0) {
                stopQuizTimer();
                endedByTimer = true;
                finishQuiz();
            }
        }, 1000);
    }

    /**
     * Blocks copy/cut when selection is inside the active quiz panel.
     *
     * @param {ClipboardEvent} e
     */
    function guardQuizClipboard(e) {
        if (playPanel.hidden) return;
        const t = e.target;
        if (t instanceof Node && playPanel.contains(t)) {
            e.preventDefault();
            return;
        }
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        let n = range.commonAncestorContainer;
        if (n.nodeType !== Node.ELEMENT_NODE) n = n.parentElement;
        if (n && playPanel.contains(n)) e.preventDefault();
    }

    document.addEventListener("copy", guardQuizClipboard, true);
    document.addEventListener("cut", guardQuizClipboard, true);
    playPanel.addEventListener("contextmenu", (e) => {
        if (!playPanel.hidden) e.preventDefault();
    });
    playPanel.addEventListener("dragstart", (e) => {
        if (!playPanel.hidden) e.preventDefault();
    });

    async function ensurePool() {
        if (pool) return;
        const r = await fetch(new URL("/data/sql-quiz.json", window.location.origin));
        if (!r.ok) throw new Error("load");
        const data = await r.json();
        const qs = data.questions;
        if (!Array.isArray(qs) || qs.length < 10) throw new Error("load");
        pool = qs;
        theoreticalPool = qs.filter((q) => q.type === "theoretical");
        practicalPool   = qs.filter((q) => q.type === "practical");
        if (theoreticalPool.length < 5 || practicalPool.length < 5) throw new Error("load");
        topicLabels = data.topicLabels || {};
    }

    function renderQuestion() {
        const q = selected[qIndex];
        progLabel.textContent = `Question ${qIndex + 1} / 10`;
        qWrap.innerHTML = "";

        // Type badge: "Concept" (theoretical) or "Read the query" (practical)
        const badge       = document.createElement("span");
        const isPractical = q.type === "practical";
        badge.className   = `sql-quiz-q-type-badge ${isPractical ? "is-query" : "is-concept"}`;
        badge.textContent = isPractical ? "Read the query" : "Concept";
        qWrap.appendChild(badge);

        const p       = document.createElement("p");
        p.className   = "sql-quiz-q-text sql-quiz-q-code";
        p.textContent = formatSqlQuestionForDisplay(q.q, isPractical);
        qWrap.appendChild(p);

        const opts = document.createElement("div");
        opts.className = "sql-quiz-options";
        q.options.forEach((text, oi) => {
            const lab = document.createElement("label");
            lab.className = "sql-quiz-opt";
            const inp = document.createElement("input");
            inp.type  = "radio";
            inp.name  = "sql-quiz-opt";
            inp.value = String(oi);
            if (answers[qIndex] === oi) inp.checked = true;
            inp.addEventListener("change", () => { answers[qIndex] = oi; });
            const sp = document.createElement("span");
            sp.textContent = text;
            lab.appendChild(inp);
            lab.appendChild(sp);
            opts.appendChild(lab);
        });
        qWrap.appendChild(opts);
        btnPrev.hidden      = qIndex === 0;
        btnNext.textContent = qIndex === 9 ? "Submit" : "Next";
    }

    function computeTier(score) {
        if (score >= 9) return "pro";
        if (score >= 6) return "intermediate";
        if (score === 5) return "novice";
        return "beginner";
    }

    /**
     * Human-readable tier label for downloads and blurbs.
     *
     * @param {string} tier
     * @returns {string}
     */
    function tierDisplayName(tier) {
        if (tier === "pro") return "Professional analyst level";
        if (tier === "intermediate") return "Intermediate";
        if (tier === "novice") return "Developing (between beginner & intermediate)";
        return "Beginner";
    }

    /**
     * Draws a score certificate on an off-screen canvas (2× for crisp screens).
     *
     * @param {{ name: string, score: number, tier: string, timedOut: boolean, atIso: string }} snap
     * @returns {HTMLCanvasElement}
     */
    function buildCertificateCanvas(snap) {
        const W = 900, H = 560;
        const DPR = 2;
        const canvas = document.createElement("canvas");
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        const ctx = canvas.getContext("2d");
        if (!ctx) return canvas;
        ctx.scale(DPR, DPR);

        /** Draw a rounded rectangle path. */
        function rrect(x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }

        /** Draw a horizontal fade-in/out rule centred on W/2. */
        function hRule(y, alpha) {
            const lw = 260;
            const g = ctx.createLinearGradient(W / 2 - lw, y, W / 2 + lw, y);
            g.addColorStop(0, "rgba(124,106,255,0)");
            g.addColorStop(0.5, `rgba(124,106,255,${alpha})`);
            g.addColorStop(1, "rgba(124,106,255,0)");
            ctx.strokeStyle = g;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(W / 2 - lw, y);
            ctx.lineTo(W / 2 + lw, y);
            ctx.stroke();
        }

        // ── background ───────────────────────────────────────
        ctx.fillStyle = "#0d0d18";
        ctx.fillRect(0, 0, W, H);

        // Subtle central glow
        const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 340);
        glow.addColorStop(0, "rgba(124,106,255,0.07)");
        glow.addColorStop(1, "rgba(124,106,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // ── outer border ─────────────────────────────────────
        ctx.strokeStyle = "#7c6aff";
        ctx.lineWidth = 2.5;
        rrect(6, 6, W - 12, H - 12, 14);
        ctx.stroke();

        // ── inner border ─────────────────────────────────────
        ctx.strokeStyle = "rgba(124,106,255,0.25)";
        ctx.lineWidth = 1;
        rrect(18, 18, W - 36, H - 36, 10);
        ctx.stroke();

        // ── corner diamonds ───────────────────────────────────
        ctx.fillStyle = "rgba(124,106,255,0.7)";
        [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]].forEach(([cx, cy]) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-4, -4, 8, 8);
            ctx.restore();
        });

        // ── title ────────────────────────────────────────────
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#9d8fff";
        if ("letterSpacing" in ctx) ctx.letterSpacing = "4px";
        ctx.font = "700 12px system-ui,-apple-system,sans-serif";
        ctx.fillText("THE QUERY GAUNTLET", W / 2, 58);
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

        hRule(76, 0.7);

        // ── subtitle ─────────────────────────────────────────
        ctx.fillStyle = "rgba(210,210,255,0.45)";
        if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
        ctx.font = "400 10px system-ui,sans-serif";
        ctx.fillText("CERTIFICATE OF ACHIEVEMENT", W / 2, 100);
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

        // ── "This certifies that" ────────────────────────────
        ctx.fillStyle = "rgba(200,200,230,0.5)";
        ctx.font = "italic 400 15px Georgia,'Times New Roman',serif";
        ctx.fillText("This certifies that", W / 2, 148);

        // ── name ─────────────────────────────────────────────
        ctx.fillStyle = "#ffffff";
        const nfs = snap.name.length > 24 ? 36 : snap.name.length > 18 ? 42 : 50;
        ctx.font = `italic 600 ${nfs}px Georgia,'Times New Roman',serif`;
        ctx.fillText(snap.name, W / 2, 208);

        hRule(234, 0.35);

        // ── "achieved a score of" ────────────────────────────
        ctx.fillStyle = "rgba(200,200,230,0.45)";
        ctx.font = "400 14px system-ui,sans-serif";
        ctx.fillText("achieved a score of", W / 2, 264);

        // ── score ─────────────────────────────────────────────
        ctx.fillStyle = "#7c6aff";
        ctx.font = "700 78px system-ui,-apple-system,sans-serif";
        ctx.fillText(`${snap.score} / 10`, W / 2, 340);

        // ── tier ──────────────────────────────────────────────
        ctx.fillStyle = "rgba(200,200,240,0.6)";
        if ("letterSpacing" in ctx) ctx.letterSpacing = "1.5px";
        ctx.font = "600 13px system-ui,sans-serif";
        ctx.fillText(tierDisplayName(snap.tier).toUpperCase(), W / 2, 382);
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

        hRule(408, 0.35);

        // ── date ──────────────────────────────────────────────
        const dateStr = new Date(snap.atIso).toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric",
        });
        ctx.fillStyle = "rgba(200,200,230,0.35)";
        ctx.font = "400 12px system-ui,sans-serif";
        ctx.fillText(dateStr, W / 2, 440);

        // ── url ───────────────────────────────────────────────
        ctx.fillStyle = "rgba(124,106,255,0.5)";
        ctx.font = "400 11px system-ui,sans-serif";
        ctx.fillText("rushikeshwagh.vercel.app/#fun", W / 2, 510);

        return canvas;
    }

    /**
     * Short post for LinkedIn (user can paste or edit).
     *
     * @param {{ name: string, score: number, tier: string }} snap
     * @returns {string}
     */
    function buildLinkedInBlurb(snap) {
        const level = tierDisplayName(snap.tier);
        return (
            `I scored ${snap.score}/10 on The Query Gauntlet — a timed SQL quiz (JOINs, window functions, CTEs, optimization & more). ` +
            `Level: ${level}. Try it here: ${QUIZ_SHARE_URL}`
        );
    }

    function finishQuiz() {
        if (quizCompleted) return;
        quizCompleted = true;
        stopQuizTimer();

        let score = 0;
        const wrongTopicKeys = [];
        selected.forEach((q, i) => {
            if (answers[i] === q.answer) score += 1;
            else wrongTopicKeys.push(q.topic);
        });
        const uniqueWrong = [...new Set(wrongTopicKeys)];
        const tier = computeTier(score);

        playPanel.hidden = true;
        resPanel.hidden = false;

        proCard.hidden = tier !== "pro";
        resultStandard.hidden = false;
        resultHeading.textContent = tier === "pro" ? "Summary" : "Your results";
        if (endedByTimer) {
            scoreLine.textContent = `You scored ${score} / 10. The timer reached zero — any unanswered or unsubmitted questions count as incorrect.`;
        } else {
            scoreLine.textContent = `You scored ${score} / 10.`;
        }
        if (tier === "pro" && proScoreEl) proScoreEl.textContent = `${score}/10`;

        if (tier === "beginner") {
            tierMsg.textContent =
                "You are at a beginner level on this quiz. Use the topic list below to guide what to study next.";
        } else if (tier === "novice") {
            tierMsg.textContent =
                "You are between beginner and intermediate — review the topics below and aim for 6+ correct to reach intermediate.";
        } else if (tier === "intermediate") {
            tierMsg.textContent =
                "You are intermediate and close to professional analyst level. Sharpen the areas below to close the gap.";
        } else {
            tierMsg.textContent = "Outstanding work. You cleared the gauntlet with pro-level SQL instincts.";
            triggerFunCelebration(quizCard, { pieces: 34, durationMs: 2400 });
        }

        topicsList.innerHTML = "";
        if (uniqueWrong.length) {
            topicsBlock.hidden = false;
            uniqueWrong.forEach((key) => {
                const li = document.createElement("li");
                li.textContent = topicLabels[key] || key;
                topicsList.appendChild(li);
            });
        } else {
            topicsBlock.hidden = true;
        }

        const topicLines = uniqueWrong.map((key) => topicLabels[key] || key);
        lastScoreSnapshot = {
            name: participantName,
            email: participantEmail,
            score,
            tier,
            topicLines,
            timedOut: endedByTimer,
            atIso: new Date().toISOString(),
        };

        if (copyHint) copyHint.hidden = true;
        emailStatus.textContent = "Recording your attempt…";
        emailStatus.className = "sql-quiz-email-status";

        fetch(new URL("/api/send-quiz-email", window.location.origin), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: participantName,
                email: participantEmail,
                score,
                totalQuestions: 10,
                tier,
                wrongTopicKeys: uniqueWrong,
                timedOut: endedByTimer,
            }),
        })
            .then(async (r) => {
                const data = await r.json().catch(() => ({}));
                return { ok: r.ok, data };
            })
            .then(({ ok, data }) => {
                if (ok && data.ok) {
                    emailStatus.textContent = "Thanks — your attempt was recorded. Download or share your score below.";
                    emailStatus.className = "sql-quiz-email-status is-ok";
                } else if (data.code === "MISSING_RESEND") {
                    emailStatus.textContent =
                        "Server email is not configured — your score is still yours: download or share below.";
                    emailStatus.className = "sql-quiz-email-status is-err";
                } else {
                    emailStatus.textContent =
                        "Could not log your attempt on the server — you can still download or share below.";
                    emailStatus.className = "sql-quiz-email-status is-err";
                }
            })
            .catch(() => {
                emailStatus.textContent = "Could not reach the server — you can still download or share your score below.";
                emailStatus.className = "sql-quiz-email-status is-err";
            });
    }

    if (btnDownload) {
        btnDownload.addEventListener("click", () => {
            if (!lastScoreSnapshot) return;
            const certCanvas = buildCertificateCanvas(lastScoreSnapshot);
            certCanvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `query-gauntlet-certificate-${lastScoreSnapshot.score}-of-10.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, "image/png");
        });
    }

    if (btnLinkedIn) {
        btnLinkedIn.addEventListener("click", () => {
            const share = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(QUIZ_SHARE_URL)}`;
            window.open(share, "_blank", "noopener,noreferrer");
        });
    }

    if (btnCopyBlurb) {
        btnCopyBlurb.addEventListener("click", async () => {
            if (!lastScoreSnapshot) return;
            const blurb = buildLinkedInBlurb(lastScoreSnapshot);
            try {
                await navigator.clipboard.writeText(blurb);
                if (copyHint) {
                    copyHint.hidden = false;
                    copyHint.textContent = "Copied suggested post text — paste into LinkedIn.";
                }
            } catch {
                if (copyHint) {
                    copyHint.hidden = false;
                    copyHint.textContent = "Could not copy automatically — select and copy manually from a note app.";
                }
            }
        });
    }

    async function startQuizFromForm() {
        loadErr.hidden = true;
        if (!form.reportValidity()) return;
        participantName = document.getElementById("sql-quiz-name").value.trim();
        participantEmail = document.getElementById("sql-quiz-email").value.trim();
        try {
            await ensurePool();
        } catch {
            loadErr.textContent = "Could not load quiz data. Please refresh and try again.";
            loadErr.hidden = false;
            return;
        }
        // Pick 5 theoretical + 5 practical, then interleave randomly
        const thCopy = [...theoreticalPool];
        const prCopy = [...practicalPool];
        shuffleInPlace(thCopy);
        shuffleInPlace(prCopy);
        selected = shuffleInPlace([...thCopy.slice(0, 5), ...prCopy.slice(0, 5)]);
        answers = selected.map(() => null);
        qIndex = 0;
        quizCompleted = false;
        endedByTimer = false;
        regPanel.hidden = true;
        playPanel.hidden = false;
        renderQuestion();
        startQuizTimer();
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();
    });
    btnStart.addEventListener("click", () => {
        void startQuizFromForm();
    });

    btnPrev.addEventListener("click", () => {
        if (qIndex > 0) {
            qIndex -= 1;
            renderQuestion();
        }
    });

    btnNext.addEventListener("click", () => {
        if (answers[qIndex] === null || answers[qIndex] === undefined) {
            // Inline error instead of disruptive alert
            let errMsg = qWrap.querySelector(".sql-quiz-inline-err");
            if (!errMsg) {
                errMsg = document.createElement("p");
                errMsg.className = "sql-quiz-inline-err";
                qWrap.appendChild(errMsg);
            }
            errMsg.textContent = "Choose an answer before continuing.";
            return;
        }
        // Clear any lingering inline error
        const prevErr = qWrap.querySelector(".sql-quiz-inline-err");
        if (prevErr) prevErr.remove();
        if (qIndex < 9) {
            qIndex += 1;
            renderQuestion();
        } else {
            finishQuiz();
        }
    });

    btnRetry.addEventListener("click", () => {
        stopQuizTimer();
        quizCompleted = false;
        endedByTimer = false;
        resPanel.hidden = true;
        playPanel.hidden = true;
        regPanel.hidden = false;
        form.reset();
        selected        = [];
        answers         = [];
        pool            = null;
        theoreticalPool = [];
        practicalPool   = [];
        if (timerEl) {
            secondsLeft = SQL_QUIZ_TIME_SEC;
            timerEl.classList.remove("is-low", "is-critical");
            updateTimerDisplay();
        }
        lastScoreSnapshot = null;
        if (copyHint) copyHint.hidden = true;
        emailStatus.textContent = "";
        emailStatus.className = "sql-quiz-email-status";
    });

    applyQuizQueryPrefill();
}

// ── Tool sub-tabs ─────────────────────────────────────────────
function initToolSwitcher() {
    const tabs = document.querySelectorAll(".tool-switch");
    const panelIds = ["ab", "json", "sql", "cohort"];
    const panels = {};
    panelIds.forEach((id) => { panels[id] = document.getElementById(`tool-panel-${id}`); });
    if (!tabs.length) return;

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const id = tab.dataset.tool;
            tabs.forEach((t) => {
                const on = t.dataset.tool === id;
                t.classList.toggle("active", on);
                t.setAttribute("aria-selected", on ? "true" : "false");
            });
            Object.entries(panels).forEach(([key, el]) => {
                if (el) el.hidden = key !== id;
            });
        });
    });
}

/**
 * Fills `#site-revision-label` from `script.js?v=…` on this page (single bump for cache + visible rev).
 */
function initSiteRevisionLabel() {
    const el = document.getElementById("site-revision-label");
    if (!el) return;
    const sc = document.querySelector('script[src*="script.js"]');
    const src = sc?.getAttribute("src") || "";
    const m = src.match(/[?&]v=([^&]+)/);
    el.textContent = m ? decodeURIComponent(m[1]) : "local";
}

// ── Boot ────────────────────────────────────────────────────
// ── Keywordle (daily Wordle for SQL / data keywords) ─────────

/**
 * Initialises Keywordle — a Wordle-style daily word puzzle
 * using 5-letter SQL and analytics terms. One new word per day.
 */
function initSqlWord() {
    const WORDS = [
        "QUERY", "PIVOT", "INDEX", "UNION", "LIMIT",
        "COUNT", "DENSE", "NTILE", "ALIAS", "TABLE",
        "RANGE", "CROSS", "NULLS", "FLOAT", "CHART",
        "TREND", "ALPHA", "EPOCH", "BATCH", "INNER",
        "OUTER", "GROUP", "PARSE", "DELTA", "SLICE",
        "GRANT", "CLEAN", "STATS", "PANEL", "POWER",
    ];

    const gridEl   = document.getElementById("sw-grid");
    const kbEl     = document.getElementById("sw-keyboard");
    const msgEl    = document.getElementById("sw-message");
    const shareBtn = document.getElementById("sw-share");
    const hintBtn  = document.getElementById("sw-hint-btn");
    const hintText = document.getElementById("sw-hint-text");
    const keywordleCard = document.getElementById("keywordle-card");
    if (!gridEl || !kbEl || !msgEl) return;

    // Derive today's word from a fixed epoch so everyone shares the same word.
    const epoch   = new Date("2026-04-01T00:00:00");
    const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
    const dayIndex = Math.max(0, Math.floor((todayMs - epoch.getTime()) / 86400000));
    const TARGET   = WORDS[dayIndex % WORDS.length];

    const ROWS = 6;
    const COLS = 5;
    /** Middle column (0-based) — given free on the first guess row. */
    const SEED_COL = 2;

    let currentRow = 0;
    const board        = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    const guessResults = /** @type {string[][]} */ ([]);
    const letterStates = /** @type {Record<string,string>} */ ({});
    let done = false;
    let messageTimerId = /** @type {number | null} */ (null);

    const hintStorageKey = `keywordle-hint-${dayIndex}`;

    /**
     * Column order for typing (row 0 skips the seeded middle letter).
     *
     * @param {number} rowIdx
     * @returns {number[]}
     */
    function writableOrder(rowIdx) {
        return rowIdx === 0 ? [0, 1, 3, 4] : [0, 1, 2, 3, 4];
    }

    /**
     * Next empty cell in typing order, or COLS if the row is full.
     *
     * @param {number} rowIdx
     * @returns {number}
     */
    function firstEmptyWritable(rowIdx) {
        for (const c of writableOrder(rowIdx)) {
            if (!board[rowIdx][c]) return c;
        }
        return COLS;
    }

    /**
     * Rightmost filled writable cell, excluding the locked seed letter on row 0.
     *
     * @param {number} rowIdx
     * @returns {number}
     */
    function lastFilledWritable(rowIdx) {
        const order = writableOrder(rowIdx);
        for (let i = order.length - 1; i >= 0; i--) {
            const c = order[i];
            if (rowIdx === 0 && c === SEED_COL) continue;
            if (board[rowIdx][c]) return c;
        }
        return -1;
    }

    // Build grid cells
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement("div");
            cell.className = "sw-cell";
            cell.id = `sw-${r}-${c}`;
            gridEl.appendChild(cell);
        }
    }

    // Build on-screen keyboard
    [
        ["Q","W","E","R","T","Y","U","I","O","P"],
        ["A","S","D","F","G","H","J","K","L"],
        ["ENTER","Z","X","C","V","B","N","M","⌫"],
    ].forEach((row) => {
        const rowEl = document.createElement("div");
        rowEl.className = "sw-key-row";
        row.forEach((key) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sw-key" + (key.length > 1 ? " wide" : "");
            btn.textContent = key;
            btn.dataset.swKey = key;
            btn.addEventListener("click", () => handleSwKey(key));
            rowEl.appendChild(btn);
        });
        kbEl.appendChild(rowEl);
    });

    /** @param {number} r @param {number} c @returns {HTMLElement|null} */
    function swCell(r, c) {
        return document.getElementById(`sw-${r}-${c}`);
    }

    /**
     * Update a cell's letter and trigger pop animation.
     * @param {number} r
     * @param {number} c
     * @param {string} letter
     */
    function updateSwCell(r, c, letter) {
        const el = swCell(r, c);
        if (!el) return;
        el.textContent = letter;
        if (letter) {
            el.dataset.letter = letter;
            el.classList.add("sw-pop");
            setTimeout(() => el.classList.remove("sw-pop"), 160);
        } else {
            delete el.dataset.letter;
        }
    }

    // First row: reveal middle letter (same for everyone that day).
    board[0][SEED_COL] = TARGET[SEED_COL];
    updateSwCell(0, SEED_COL, TARGET[SEED_COL]);
    swCell(0, SEED_COL)?.classList.add("sw-seed");

    /**
     * Show a transient message.
     * @param {string} text
     * @param {number} [duration=2400] - 0 to persist.
     */
    function showSwMsg(text, duration, isWin) {
        if (!msgEl) return;
        if (messageTimerId !== null) {
            window.clearTimeout(messageTimerId);
            messageTimerId = null;
        }
        msgEl.textContent = text;
        msgEl.classList.toggle("is-win", Boolean(isWin));
        const ms = duration === undefined ? 2400 : duration;
        if (ms > 0) {
            messageTimerId = window.setTimeout(() => {
                if (msgEl.textContent === text) {
                    msgEl.textContent = "";
                    msgEl.classList.remove("is-win");
                }
                messageTimerId = null;
            }, ms);
        }
    }

    /**
     * Handle a key press (letter, ENTER, or backspace).
     * @param {string} key
     */
    function handleSwKey(key) {
        if (done) return;
        if (key === "⌫" || key === "BACKSPACE") {
            const last = lastFilledWritable(currentRow);
            if (last < 0) return;
            board[currentRow][last] = "";
            const el = swCell(currentRow, last);
            if (el) {
                el.textContent = "";
                delete el.dataset.letter;
                el.classList.remove("sw-pop", "sw-correct", "sw-present", "sw-absent");
            }
        } else if (key === "ENTER") {
            submitSwGuess();
        } else if (/^[A-Z]$/.test(key)) {
            const next = firstEmptyWritable(currentRow);
            if (next >= COLS) return;
            board[currentRow][next] = key;
            updateSwCell(currentRow, next, key);
        }
    }

    /**
     * Score a 5-letter guess against the target.
     * @param {string} guess
     * @returns {string[]} array of "sw-correct" | "sw-present" | "sw-absent"
     */
    function scoreSwGuess(guess) {
        const result   = Array(COLS).fill("sw-absent");
        const remaining = TARGET.split("");
        // First pass — exact matches
        for (let i = 0; i < COLS; i++) {
            if (guess[i] === TARGET[i]) {
                result[i]      = "sw-correct";
                remaining[i]   = "";
            }
        }
        // Second pass — wrong-position matches
        for (let i = 0; i < COLS; i++) {
            if (result[i] !== "sw-absent") continue;
            const idx = remaining.indexOf(guess[i]);
            if (idx !== -1) {
                result[i]     = "sw-present";
                remaining[idx] = "";
            }
        }
        return result;
    }

    function submitSwGuess() {
        if (firstEmptyWritable(currentRow) < COLS) { showSwMsg("Not enough letters"); return; }
        const guess  = board[currentRow].join("");
        const result = scoreSwGuess(guess);
        guessResults.push(result);

        // Flip cells with a cascade delay
        result.forEach((cls, c) => {
            setTimeout(() => {
                const el = swCell(currentRow, c);
                if (el) {
                    el.classList.remove("sw-seed");
                    el.classList.add(cls);
                }
            }, c * 100);
        });

        // Update letter-state map (correct > present > absent)
        const rankMap = { "sw-correct": 3, "sw-present": 2, "sw-absent": 1 };
        result.forEach((cls, c) => {
            const letter = guess[c];
            const cur    = letterStates[letter];
            if (!cur || (rankMap[cls] || 0) > (rankMap[cur] || 0)) {
                letterStates[letter] = cls;
            }
        });
        setTimeout(refreshSwKeyboard, COLS * 100 + 60);

        const won = guess === TARGET;
        if (won || currentRow === ROWS - 1) {
            done = true;
            const msgs = [
                "Perfect start. You solved today's Keywordle in one shot.",
                "Excellent. You cracked today's Keywordle in two tries.",
                "Sharp work. Keywordle solved.",
                "Nice one. You found the word with room to spare.",
                "Well played. You got there.",
                "Clutch finish. Keywordle solved on the last row.",
            ];
            setTimeout(() => {
                if (won) {
                    showSwMsg(msgs[currentRow] || "Correct!", 0, true);
                    triggerFunCelebration(keywordleCard, { pieces: 24, durationMs: 2200 });
                } else {
                    showSwMsg(`The word was ${TARGET}`, 0, false);
                }
                if (shareBtn) shareBtn.hidden = false;
                if (hintBtn) hintBtn.disabled = true;
            }, COLS * 100 + 220);
        }

        currentRow++;
    }

    function refreshSwKeyboard() {
        kbEl.querySelectorAll(".sw-key[data-sw-key]").forEach((btn) => {
            const k = /** @type {HTMLElement} */ (btn).dataset.swKey || "";
            if (k.length === 1 && letterStates[k]) {
                btn.classList.remove("sw-correct", "sw-present", "sw-absent");
                btn.classList.add(letterStates[k]);
            }
        });
    }

    if (hintBtn && hintText) {
        const savedHint = localStorage.getItem(hintStorageKey);
        if (savedHint) {
            hintText.textContent = savedHint;
            hintText.hidden = false;
            hintBtn.disabled = true;
        }
        hintBtn.addEventListener("click", () => {
            if (done) return;
            if (localStorage.getItem(hintStorageKey)) return;
            const pool = [0, 1, 3, 4];
            const idx = pool[Math.floor(Math.random() * pool.length)];
            const letter = TARGET[idx];
            const msg = `Hint: today's word includes the letter ${letter}.`;
            localStorage.setItem(hintStorageKey, msg);
            hintText.textContent = msg;
            hintText.hidden = false;
            hintBtn.disabled = true;
            showSwMsg("Hint revealed.", 2000, false);
        });
    }

    // Physical keyboard — only intercept when fun tab is open and no text field is focused
    document.addEventListener("keydown", (e) => {
        if (document.getElementById("view-fun")?.hasAttribute("hidden")) return;
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        const k = e.key.toUpperCase();
        if (k === "BACKSPACE") { e.preventDefault(); handleSwKey("⌫"); }
        else if (k === "ENTER") handleSwKey("ENTER");
        else if (/^[A-Z]$/.test(k)) handleSwKey(k);
    });

    // Share button — copy emoji grid to clipboard
    if (shareBtn) {
        shareBtn.addEventListener("click", () => {
            const emojiMap = { "sw-correct": "🟩", "sw-present": "🟨", "sw-absent": "⬛" };
            const gridText = guessResults
                .map((row) => row.map((s) => emojiMap[s] || "⬛").join(""))
                .join("\n");
            const wonRow  = guessResults.findIndex((r) => r.every((s) => s === "sw-correct"));
            const result  = wonRow >= 0 ? `${wonRow + 1}/${ROWS}` : `X/${ROWS}`;
            const word    = String(dayIndex % WORDS.length + 1);
            const text    = `Keywordle #${word} ${result}\n\n${gridText}\n\nrushikeshwagh.vercel.app/#fun`;
            navigator.clipboard.writeText(text)
                .then(() => showSwMsg("Copied to clipboard!", 2400, false))
                .catch(() => showSwMsg("Copy not supported in this browser", 2400, false));
        });
    }
}

// ── Metric Blitz (5-question KPI speed round) ────────────────

/**
 * Builds a multiple-choice question and shuffles the option order.
 *
 * @param {string} prompt
 * @param {string} correctOption
 * @param {string[]} wrongOptions
 * @returns {{ q: string, opts: string[], ans: number }}
 */
function createMetricBlitzQuestion(prompt, correctOption, wrongOptions) {
    const options = pickRandomItems([correctOption, ...wrongOptions], 4);
    return {
        q: prompt,
        opts: options,
        ans: options.indexOf(correctOption),
    };
}

/**
 * Formats currency values without trailing decimal places.
 *
 * @param {number} amount
 * @returns {string}
 */
function formatMetricCurrency(amount) {
    return `$${amount.toLocaleString("en-US")}`;
}

/**
 * Formats percentages with one decimal place for compact display.
 *
 * @param {number} value
 * @returns {string}
 */
function formatMetricPercent(value) {
    return `${value.toFixed(1)}%`;
}

/**
 * Builds the Metric Blitz question pool used for random rounds.
 *
 * @returns {{ q: string, opts: string[], ans: number }[]}
 */
function buildMetricBlitzQuestionBank() {
    const questionBank = [];

    const arpuScenarios = [
        { revenue: 36000, users: 1200, wrongs: [formatMetricCurrency(18), formatMetricCurrency(45), formatMetricCurrency(60)] },
        { revenue: 50000, users: 2000, wrongs: [formatMetricCurrency(10), formatMetricCurrency(40), formatMetricCurrency(100)] },
        { revenue: 84000, users: 2800, wrongs: [formatMetricCurrency(21), formatMetricCurrency(35), formatMetricCurrency(56)] },
        { revenue: 27000, users: 900, wrongs: [formatMetricCurrency(15), formatMetricCurrency(45), formatMetricCurrency(90)] },
        { revenue: 96000, users: 3200, wrongs: [formatMetricCurrency(24), formatMetricCurrency(40), formatMetricCurrency(48)] },
        { revenue: 45500, users: 1300, wrongs: [formatMetricCurrency(21), formatMetricCurrency(30), formatMetricCurrency(42)] },
        { revenue: 72000, users: 1800, wrongs: [formatMetricCurrency(20), formatMetricCurrency(30), formatMetricCurrency(60)] },
        { revenue: 61500, users: 1500, wrongs: [formatMetricCurrency(25), formatMetricCurrency(35), formatMetricCurrency(50)] },
        { revenue: 108000, users: 3600, wrongs: [formatMetricCurrency(18), formatMetricCurrency(24), formatMetricCurrency(45)] },
        { revenue: 39000, users: 1300, wrongs: [formatMetricCurrency(20), formatMetricCurrency(26), formatMetricCurrency(39)] },
    ];
    arpuScenarios.forEach((scenario) => {
        questionBank.push(
            createMetricBlitzQuestion(
                `MRR = ${formatMetricCurrency(scenario.revenue)} and active users = ${scenario.users}. What is ARPU?`,
                formatMetricCurrency(scenario.revenue / scenario.users),
                scenario.wrongs,
            ),
        );
    });

    const aovScenarios = [
        { revenue: 18000, orders: 240, wrongs: [formatMetricCurrency(45), formatMetricCurrency(60), formatMetricCurrency(90)] },
        { revenue: 22500, orders: 300, wrongs: [formatMetricCurrency(50), formatMetricCurrency(90), formatMetricCurrency(120)] },
        { revenue: 42000, orders: 560, wrongs: [formatMetricCurrency(42), formatMetricCurrency(60), formatMetricCurrency(84)] },
        { revenue: 31200, orders: 390, wrongs: [formatMetricCurrency(52), formatMetricCurrency(65), formatMetricCurrency(96)] },
        { revenue: 54000, orders: 600, wrongs: [formatMetricCurrency(45), formatMetricCurrency(75), formatMetricCurrency(120)] },
        { revenue: 28600, orders: 220, wrongs: [formatMetricCurrency(78), formatMetricCurrency(104), formatMetricCurrency(156)] },
        { revenue: 12500, orders: 125, wrongs: [formatMetricCurrency(50), formatMetricCurrency(75), formatMetricCurrency(125)] },
        { revenue: 46800, orders: 360, wrongs: [formatMetricCurrency(90), formatMetricCurrency(104), formatMetricCurrency(156)] },
        { revenue: 19800, orders: 180, wrongs: [formatMetricCurrency(66), formatMetricCurrency(88), formatMetricCurrency(132)] },
        { revenue: 36000, orders: 450, wrongs: [formatMetricCurrency(60), formatMetricCurrency(90), formatMetricCurrency(120)] },
    ];
    aovScenarios.forEach((scenario) => {
        questionBank.push(
            createMetricBlitzQuestion(
                `Revenue = ${formatMetricCurrency(scenario.revenue)} and orders = ${scenario.orders}. What is AOV?`,
                formatMetricCurrency(scenario.revenue / scenario.orders),
                scenario.wrongs,
            ),
        );
    });

    const cacScenarios = [
        { spend: 16000, customers: 400, wrongs: [formatMetricCurrency(20), formatMetricCurrency(60), formatMetricCurrency(80)] },
        { spend: 27500, customers: 550, wrongs: [formatMetricCurrency(25), formatMetricCurrency(40), formatMetricCurrency(75)] },
        { spend: 36000, customers: 600, wrongs: [formatMetricCurrency(30), formatMetricCurrency(45), formatMetricCurrency(90)] },
        { spend: 19200, customers: 320, wrongs: [formatMetricCurrency(24), formatMetricCurrency(40), formatMetricCurrency(72)] },
        { spend: 45000, customers: 900, wrongs: [formatMetricCurrency(25), formatMetricCurrency(60), formatMetricCurrency(100)] },
        { spend: 13200, customers: 220, wrongs: [formatMetricCurrency(30), formatMetricCurrency(44), formatMetricCurrency(88)] },
        { spend: 24800, customers: 620, wrongs: [formatMetricCurrency(20), formatMetricCurrency(31), formatMetricCurrency(62)] },
        { spend: 31500, customers: 700, wrongs: [formatMetricCurrency(30), formatMetricCurrency(52), formatMetricCurrency(90)] },
        { spend: 54000, customers: 1200, wrongs: [formatMetricCurrency(25), formatMetricCurrency(36), formatMetricCurrency(72)] },
        { spend: 8400, customers: 140, wrongs: [formatMetricCurrency(24), formatMetricCurrency(36), formatMetricCurrency(84)] },
    ];
    cacScenarios.forEach((scenario) => {
        questionBank.push(
            createMetricBlitzQuestion(
                `Paid marketing spend = ${formatMetricCurrency(scenario.spend)} and new customers = ${scenario.customers}. What is CAC?`,
                formatMetricCurrency(scenario.spend / scenario.customers),
                scenario.wrongs,
            ),
        );
    });

    const ctrScenarios = [
        { clicks: 240, impressions: 8000, wrongs: [formatMetricPercent(1.5), formatMetricPercent(4.8), formatMetricPercent(8)] },
        { clicks: 325, impressions: 6500, wrongs: [formatMetricPercent(2.5), formatMetricPercent(6.5), formatMetricPercent(10)] },
        { clicks: 96, impressions: 3200, wrongs: [formatMetricPercent(1.2), formatMetricPercent(4.5), formatMetricPercent(9.6)] },
        { clicks: 510, impressions: 17000, wrongs: [formatMetricPercent(1.7), formatMetricPercent(5.1), formatMetricPercent(8.5)] },
        { clicks: 420, impressions: 12000, wrongs: [formatMetricPercent(2.1), formatMetricPercent(4.2), formatMetricPercent(7)] },
        { clicks: 180, impressions: 4500, wrongs: [formatMetricPercent(2), formatMetricPercent(6), formatMetricPercent(9)] },
        { clicks: 275, impressions: 11000, wrongs: [formatMetricPercent(1.4), formatMetricPercent(5), formatMetricPercent(11)] },
        { clicks: 840, impressions: 24000, wrongs: [formatMetricPercent(2.1), formatMetricPercent(4.2), formatMetricPercent(8.4)] },
        { clicks: 150, impressions: 3750, wrongs: [formatMetricPercent(2.5), formatMetricPercent(5), formatMetricPercent(7.5)] },
        { clicks: 660, impressions: 22000, wrongs: [formatMetricPercent(1.8), formatMetricPercent(4.4), formatMetricPercent(6.6)] },
    ];
    ctrScenarios.forEach((scenario) => {
        questionBank.push(
            createMetricBlitzQuestion(
                `A campaign generated ${scenario.clicks} clicks from ${scenario.impressions.toLocaleString("en-US")} impressions. What is CTR?`,
                formatMetricPercent((scenario.clicks / scenario.impressions) * 100),
                scenario.wrongs,
            ),
        );
    });

    const metricConceptQuestions = [
        { q: "Which metric is usually called a north-star metric?", correct: "A single metric that best captures delivered customer value", wrongs: ["The metric with the biggest weekly variance", "The first metric a dashboard shows", "Any revenue metric chosen by finance"] },
        { q: "Activation usually measures:", correct: "Whether a new user reached the first meaningful value moment", wrongs: ["Whether the user accepted cookies", "Whether the user upgraded to annual billing", "Whether the user opened the app at least once"] },
        { q: "Day-30 retention is best defined as:", correct: "Users active on day 30 divided by users who joined that cohort", wrongs: ["Sessions on day 30 divided by all sessions", "Revenue on day 30 divided by day-1 revenue", "New users on day 30 divided by all users"] },
        { q: "Churn rate answers the question:", correct: "What share of customers stopped being active or paying", wrongs: ["How fast customer support answered tickets", "How many orders shipped late", "How many visitors bounced from landing pages"] },
        { q: "Bounce rate on a landing page is:", correct: "Single-page visits divided by total visits", wrongs: ["Exits divided by sessions with two or more pages", "Clicks divided by impressions", "Conversions divided by visits"] },
        { q: "GMV stands for:", correct: "Gross merchandise value", wrongs: ["General market valuation", "Gross margin variance", "Growth monetisation volume"] },
        { q: "ARPPU is most useful for:", correct: "Understanding revenue per paying user", wrongs: ["Tracking revenue per employee", "Tracking revenue per product page", "Measuring revenue after refunds only"] },
        { q: "Gross margin tells you:", correct: "How much revenue remains after direct cost of goods sold", wrongs: ["How much cash is in the bank", "How much revenue was collected this week", "How much paid spend was allocated to channels"] },
        { q: "A leading indicator is:", correct: "A metric that moves before the business outcome you care about", wrongs: ["A metric shown first in the dashboard", "A metric owned by leadership", "A metric that only finance can change"] },
        { q: "A lagging indicator is:", correct: "A metric that confirms performance after the fact", wrongs: ["A metric that loads slowly", "A metric with bad data quality", "A metric that is not statistically significant"] },
        { q: "Cohort analysis helps you compare:", correct: "Groups of users who started in the same period or share the same trait", wrongs: ["All metrics from different tools merged together", "Only customers who paid in cash", "Only users who visited more than once"] },
        { q: "A conversion funnel is used to:", correct: "Find where users drop off between key steps", wrongs: ["Forecast server uptime", "Estimate engineering velocity", "Compare all marketing channels at once without ordering"] },
        { q: "DAU / MAU is often used as a proxy for:", correct: "Stickiness", wrongs: ["Profitability", "Gross margin", "Infrastructure efficiency"] },
        { q: "NPS is calculated as:", correct: "% promoters minus % detractors", wrongs: ["% promoters divided by % passives", "% passives minus % detractors", "Promoters divided by all survey responses"] },
        { q: "LTV is meant to estimate:", correct: "The value a customer generates over their lifetime", wrongs: ["The last transaction value", "The value of one average order", "The total value of unpaid invoices"] },
        { q: "Payback period for CAC means:", correct: "How long it takes contribution margin to recover acquisition cost", wrongs: ["How long a refund takes to process", "How quickly support closes a ticket", "How soon a new feature ships after design sign-off"] },
        { q: "Incremental lift is:", correct: "The extra outcome caused by the intervention versus control", wrongs: ["The total outcome observed after a launch", "The average week-over-week growth rate", "The difference between revenue and margin"] },
        { q: "A vanity metric is dangerous because it:", correct: "Looks impressive without reflecting meaningful business value", wrongs: ["Always declines over time", "Can only be calculated monthly", "Requires too many SQL joins"] },
        { q: "Segmentation is useful because it:", correct: "Shows whether different user groups behave differently", wrongs: ["Replaces the need for experimentation", "Removes seasonality from time series", "Guarantees higher conversion"] },
        { q: "A guardrail metric should:", correct: "Protect the business from negative side effects while you optimize a target metric", wrongs: ["Always be the same as the primary KPI", "Only be viewed after the experiment ends", "Be ignored if the main metric improves"] },
    ];
    metricConceptQuestions.forEach((item) => {
        questionBank.push(createMetricBlitzQuestion(item.q, item.correct, item.wrongs));
    });

    const sqlConceptQuestions = [
        { q: "Which window function ranks ties without gaps?", correct: "DENSE_RANK()", wrongs: ["RANK()", "ROW_NUMBER()", "NTILE(1)"] },
        { q: "Use `HAVING` when you need to:", correct: "Filter aggregated results after `GROUP BY`", wrongs: ["Filter rows before grouping", "Sort the final result", "Rename an aggregate column"] },
        { q: "A `LEFT JOIN` keeps:", correct: "All rows from the left table and matched rows from the right", wrongs: ["Only rows with matches in both tables", "All rows from the right table only", "Only rows where both sides are null"] },
        { q: "What does `COALESCE(a, b, c)` return?", correct: "The first non-null value in the list", wrongs: ["The average of the values", "The largest non-zero value", "Only the final argument if all are present"] },
        { q: "Why would you use `UNION ALL` instead of `UNION`?", correct: "To keep duplicates and avoid the de-duplication step", wrongs: ["To sort the combined result automatically", "To join on all matching keys", "To force null values to zero"] },
        { q: "What does `ROW_NUMBER()` guarantee within each partition?", correct: "A unique sequential number for each row", wrongs: ["The same rank for ties", "No gaps when values tie", "A percentile value from 0 to 1"] },
        { q: "Which clause controls how rows are grouped before aggregation?", correct: "`GROUP BY`", wrongs: ["`ORDER BY`", "`HAVING`", "`PARTITION BY`"] },
        { q: "An `INNER JOIN` returns:", correct: "Only rows with matches in both tables", wrongs: ["All rows from the left table", "All rows from both tables regardless of match", "Only rows with null keys"] },
        { q: "A `CASE WHEN` expression is useful for:", correct: "Creating conditional logic inside a query", wrongs: ["Declaring indexes", "Merging duplicate tables", "Changing the database collation"] },
        { q: "If you want the top 3 rows per category, what is a common approach?", correct: "Use `ROW_NUMBER()` in a partition and filter ranks <= 3", wrongs: ["Use `LIMIT 3` once at the end", "Use `COUNT(*)` in the `WHERE` clause", "Use `UNION ALL` across categories"] },
        { q: "Which function counts only non-null values in a column?", correct: "`COUNT(column_name)`", wrongs: ["`COUNT(*)`", "`SUM(column_name)`", "`ROW_COUNT(column_name)`"] },
        { q: "What is the main purpose of a CTE?", correct: "To structure complex logic into named query blocks", wrongs: ["To permanently store a table", "To replace all indexes", "To auto-cache a result forever"] },
        { q: "If you need one row per customer after duplicates, you would typically use:", correct: "A de-duplication rule such as `ROW_NUMBER()` over customer ID", wrongs: ["`UNION ALL`", "`COUNT(*)` only", "`CROSS JOIN`"] },
        { q: "Which join is most likely to explode row counts if used carelessly?", correct: "`CROSS JOIN`", wrongs: ["`LEFT JOIN`", "`INNER JOIN`", "`SELF JOIN`"] },
        { q: "What does `ORDER BY 1 DESC` mean?", correct: "Sort by the first selected column in descending order", wrongs: ["Sort by one row only", "Sort by the first table in the query", "Sort by the primary key automatically"] },
        { q: "A null-safe way to avoid division-by-zero is often:", correct: "Divide by `NULLIF(denominator, 0)`", wrongs: ["Wrap the numerator in `COUNT(*)`", "Use `UNION` instead of division", "Add `ORDER BY` before the division"] },
        { q: "Window functions are evaluated:", correct: "Across a set of related rows without collapsing them into one row", wrongs: ["Only after the final `LIMIT`", "Only inside `JOIN` conditions", "Only on temporary tables"] },
        { q: "If you need the previous row's value, which function is most common?", correct: "`LAG()`", wrongs: ["`LEAD()`", "`FIRST_VALUE()`", "`NTILE()`"] },
        { q: "Why might `SUM(revenue) / COUNT(DISTINCT user_id)` be preferred over averaging user-level totals directly?", correct: "It computes revenue per unique user from the chosen grain", wrongs: ["It removes all nulls automatically from every column", "It guarantees the highest possible precision", "It converts revenue to margin"] },
        { q: "What is usually the first thing to check when a join duplicates your metrics?", correct: "Whether the join keys are one-to-many instead of one-to-one", wrongs: ["Whether the query has enough comments", "Whether the result is ordered alphabetically", "Whether the table names are singular"] },
    ];
    sqlConceptQuestions.forEach((item) => {
        questionBank.push(createMetricBlitzQuestion(item.q, item.correct, item.wrongs));
    });

    const experimentQuestions = [
        { q: "A p-value of 0.03 with alpha = 0.05 means:", correct: "The result is statistically significant at the 5% level", wrongs: ["The null hypothesis is proven true", "The effect size is definitely large", "The sample is too small to conclude anything"] },
        { q: "A Type I error means:", correct: "You concluded there was an effect when there was not one", wrongs: ["You missed a real effect", "You randomized traffic incorrectly", "You measured the wrong KPI"] },
        { q: "Statistical power is the probability of:", correct: "Detecting a true effect when it exists", wrongs: ["Avoiding every false positive", "Choosing the best variant every time", "Keeping sample size as small as possible"] },
        { q: "A holdout group is used to:", correct: "Keep a comparable baseline untouched by the treatment", wrongs: ["Increase the p-value", "Speed up significance", "Remove all seasonality from the product"] },
        { q: "Randomization matters because it:", correct: "Helps balance known and unknown factors across variants", wrongs: ["Guarantees zero churn during the test", "Lets you skip metric definitions", "Makes every sample representative of every country"] },
        { q: "The primary metric in an experiment should be:", correct: "The main outcome tied to the decision you want to make", wrongs: ["Any metric that moves the most", "The easiest metric to query", "A metric added only after the test ends"] },
        { q: "A guardrail metric is important because it:", correct: "Catches harmful trade-offs while a target metric improves", wrongs: ["Always replaces the primary metric", "Makes significance unnecessary", "Should only be checked if the test loses"] },
        { q: "Peeking is risky because it:", correct: "Inflates false-positive risk if you keep checking without a valid stopping rule", wrongs: ["Reduces the sample size requirement", "Guarantees a smaller confidence interval", "Makes control better than treatment"] },
        { q: "If a confidence interval for uplift includes zero, the safest read is:", correct: "The effect is not yet distinguishable from no effect", wrongs: ["The treatment definitely hurts the metric", "The effect is significant but small", "The sample is perfectly balanced"] },
        { q: "Sample ratio mismatch means:", correct: "Traffic split is materially different from the intended allocation", wrongs: ["The experiment ran on too many days", "The confidence interval is too wide", "The control group had more returning users only"] },
        { q: "Novelty effect refers to:", correct: "Users reacting to a change because it is new, not necessarily better long term", wrongs: ["A metric using a new SQL query", "A data delay after deployment", "A higher variance caused by weekends"] },
        { q: "Minimum detectable effect helps you decide:", correct: "What effect size is worth designing the test to reliably detect", wrongs: ["Which variant will win before launch", "How to avoid defining success criteria", "Which SQL function to use for aggregation"] },
        { q: "A false negative is:", correct: "Missing a real effect that actually exists", wrongs: ["Declaring a fake winner", "Running multiple variants at once", "Analyzing only one segment"] },
        { q: "Why are pre-registered success criteria useful?", correct: "They reduce post-hoc metric shopping and biased interpretation", wrongs: ["They increase the effect size automatically", "They remove the need for randomization", "They guarantee every test reaches significance"] },
        { q: "If treatment improves conversion but hurts retention badly, you should:", correct: "Review the decision using both the primary and guardrail metrics", wrongs: ["Ship immediately because conversion won", "Ignore retention because it is lagging", "Re-run until retention disappears"] },
        { q: "A/A tests are mainly useful for:", correct: "Checking experiment plumbing and false-positive behavior before major launches", wrongs: ["Estimating lifetime value directly", "Calculating ARPU", "Replacing all sample size calculations"] },
        { q: "Simpson's paradox is a reminder to:", correct: "Look at segment-level behavior because aggregates can reverse the story", wrongs: ["Never trust SQL joins", "Avoid all experiments with more than one metric", "Use only medians instead of means"] },
        { q: "If treatment wins only for new users but loses badly for existing users, the next best step is:", correct: "Consider a segmented rollout instead of one blanket decision", wrongs: ["Ignore the difference because the total average is enough", "Delete the losing segment from the analysis", "Always choose the control"] },
        { q: "A long-run holdout can help answer:", correct: "Whether the impact persists after the initial launch period", wrongs: ["Whether p-values are always below 0.05", "Whether SQL queries run faster in production", "Whether users read the release notes"] },
        { q: "When an experiment is underpowered, you should expect:", correct: "A higher chance of missing meaningful effects", wrongs: ["Guaranteed significance if the test runs longer than a week", "Smaller variance than normal", "Automatic correction for sample imbalance"] },
    ];
    experimentQuestions.forEach((item) => {
        questionBank.push(createMetricBlitzQuestion(item.q, item.correct, item.wrongs));
    });

    return questionBank;
}

/**
 * Initialises the Metric Blitz game — 5 analytics / SQL questions
 * answered in 30 seconds, no backend required.
 */
function initMetricBlitz() {
    const QUESTION_BANK = buildMetricBlitzQuestionBank();
    const QUESTIONS_PER_ROUND = 5;
    const TOTAL_SECS = 30;

    const startBtn  = document.getElementById("mb-start");
    const regEl     = document.getElementById("mb-reg");
    const playEl    = document.getElementById("mb-play");
    const resEl     = document.getElementById("mb-results");
    const qnumEl    = document.getElementById("mb-qnum");
    const timerEl   = document.getElementById("mb-timer");
    const qEl       = document.getElementById("mb-question");
    const optsEl    = document.getElementById("mb-options");
    const scoreEl   = document.getElementById("mb-score-line");
    const retryBtn  = document.getElementById("mb-retry");
    const metricBlitzCard = document.getElementById("metricblitz-card");
    if (!startBtn || !regEl || !playEl || !resEl) return;

    let qi = 0, score = 0, secsLeft = TOTAL_SECS;
    let timerId = /** @type {number|null} */ (null);
    let answered = false;
    let activeQuestions = [];

    function startBlitz() {
        qi = 0; score = 0; secsLeft = TOTAL_SECS; answered = false;
        activeQuestions = pickRandomItems(QUESTION_BANK, QUESTIONS_PER_ROUND);
        regEl.hidden = true;
        resEl.hidden = true;
        playEl.hidden = false;
        metricBlitzCard?.classList.remove("is-celebrating");
        scoreEl?.classList.remove("is-win", "is-strong");
        if (timerEl) { timerEl.textContent = `0:${TOTAL_SECS}`; timerEl.classList.remove("mb-hurry"); }
        clearInterval(timerId ?? undefined);
        timerId = window.setInterval(tickTimer, 1000);
        renderMbQuestion();
    }

    function tickTimer() {
        secsLeft--;
        if (timerEl) {
            timerEl.textContent = `0:${String(secsLeft).padStart(2, "0")}`;
            timerEl.classList.toggle("mb-hurry", secsLeft <= 8);
        }
        if (secsLeft <= 0) { clearInterval(timerId ?? undefined); showMbResults(); }
    }

    function renderMbQuestion() {
        if (qi >= activeQuestions.length) { clearInterval(timerId ?? undefined); showMbResults(); return; }
        answered = false;
        const q = activeQuestions[qi];
        if (qnumEl) qnumEl.textContent = `Q${qi + 1} / ${activeQuestions.length}`;
        if (qEl)    qEl.textContent = q.q;
        if (optsEl) {
            optsEl.innerHTML = "";
            q.opts.forEach((opt, i) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "mb-opt";
                btn.textContent = opt;
                btn.addEventListener("click", () => pickMbAnswer(i));
                optsEl.appendChild(btn);
            });
        }
    }

    /**
     * Handle an option selection, highlight correct/wrong, then advance.
     * @param {number} chosen
     */
    function pickMbAnswer(chosen) {
        if (answered) return;
        answered = true;
        const q = activeQuestions[qi];
        optsEl?.querySelectorAll(".mb-opt").forEach((btn, idx) => {
            /** @type {HTMLButtonElement} */ (btn).disabled = true;
            if (idx === q.ans) btn.classList.add("mb-correct");
            else if (idx === chosen) btn.classList.add("mb-wrong");
        });
        if (chosen === q.ans) score++;
        setTimeout(() => { qi++; renderMbQuestion(); }, 720);
    }

    function showMbResults() {
        clearInterval(timerId ?? undefined);
        playEl.hidden = true;
        resEl.hidden  = false;
        if (!scoreEl) return;

        scoreEl.classList.remove("is-win", "is-strong");
        if (score === QUESTIONS_PER_ROUND) {
            scoreEl.textContent = `${score} / ${QUESTIONS_PER_ROUND} — Perfect run. Metric Blitz conquered.`;
            scoreEl.classList.add("is-win");
            triggerFunCelebration(metricBlitzCard, { pieces: 30, durationMs: 2300 });
        } else if (score >= 4) {
            scoreEl.textContent = `${score} / ${QUESTIONS_PER_ROUND} — Strong round. One more and you clear the blitz.`;
            scoreEl.classList.add("is-strong");
        } else if (score === 3) {
            scoreEl.textContent = `${score} / ${QUESTIONS_PER_ROUND} — Solid pace. You were in the game.`;
        } else if (score === 2) {
            scoreEl.textContent = `${score} / ${QUESTIONS_PER_ROUND} — Good start. Try another random set.`;
        } else if (score === 1) {
            scoreEl.textContent = `${score} / ${QUESTIONS_PER_ROUND} — One correct. The next set will be different.`;
        } else {
            scoreEl.textContent = `0 / ${QUESTIONS_PER_ROUND} — Fresh five-question set waiting. Run it again.`;
        }
    }

    startBtn.addEventListener("click", startBlitz);
    retryBtn?.addEventListener("click", startBlitz);
}

initTheme();
initViews();
initReveal();
initNavScroll();
initMobileNav();
initStats();
initABCalculator();
initSampleSize();
initCohortTool();
initJsonFormatter();
initSqlTool();
initToolSwitcher();
initSqlQuiz();
initSqlWord();
initMetricBlitz();
initSiteRevisionLabel();
