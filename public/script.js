// ── Site views (tabs + hash) ─────────────────────────────────
const VIEW_IDS = ["home", "journey", "tools", "projects", "skills"];

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
    history.replaceState(null, "", `#${n}`);
    window.scrollTo({ top: 0, behavior: "instant" });
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
    "ORDER BY":      "Sorts the final result by one or more columns or expressions.",
    LIMIT:           "Caps how many rows are returned (syntax varies slightly by engine).",
    OFFSET:          "Skips rows before applying LIMIT (pagination).",
    UNION:           "Stacks results from two queries; column counts/types should align.",
    "UNION ALL":     "Like UNION but keeps duplicate rows.",
    WITH:            "Defines a common table expression (CTE) — a reusable named subquery.",
    OVER:            "Opens a window-function frame — works with PARTITION BY / ORDER BY.",
    "PARTITION BY":  "Divides rows into groups within a window function frame.",
    DISTINCT:        "Removes duplicate rows from the result set.",
    CASE:            "Conditional expression: CASE WHEN … THEN … ELSE … END.",
};

// Clause-starting keywords (longer patterns first so GROUP BY beats BY)
const SQL_CLAUSE_KW = [
    "GROUP BY", "ORDER BY", "PARTITION BY",
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
    "FOLLOWING", "CURRENT", "ROW", "ASC", "DESC", "NULLS", "FIRST", "LAST",
    "SET", "RETURNING", "EXCEPT", "INTERSECT", "RECURSIVE",
    "TRUE", "FALSE",
    // aggregate / window / scalar functions
    "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "CAST",
    "CONVERT", "EXTRACT", "DATE_TRUNC", "DATE_PART", "NOW", "CURRENT_DATE",
    "ROW_NUMBER", "RANK", "DENSE_RANK", "LAG", "LEAD", "NTILE",
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

// ── Tool sub-tabs ─────────────────────────────────────────────
function initToolSwitcher() {
    const tabs = document.querySelectorAll(".tool-switch");
    const panels = {
        ab: document.getElementById("tool-panel-ab"),
        cohort: document.getElementById("tool-panel-cohort"),
        sql: document.getElementById("tool-panel-sql"),
    };
    if (!tabs.length || !panels.ab) return;

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

// ── Boot ────────────────────────────────────────────────────
initViews();
initReveal();
initNavScroll();
initMobileNav();
initStats();
initABCalculator();
initCohortTool();
initSqlTool();
initToolSwitcher();
