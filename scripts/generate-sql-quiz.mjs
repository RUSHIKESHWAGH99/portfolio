/**
 * Builds public/data/sql-quiz.json — 1 000 MCQs.
 *   500 theoretical  (concept explanations, "what does X mean?")
 *   500 practical    (read a query, spot the error, predict output)
 *
 * Run: node scripts/generate-sql-quiz.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, "..", "public", "data");
const OUT       = join(OUT_DIR, "sql-quiz.json");
mkdirSync(OUT_DIR, { recursive: true });

/** Deterministic Fisher-Yates with a simple LCG so the same ID always picks same order. */
function shuffleDet(items, seed) {
    const a = [...items];
    let s   = seed >>> 0;
    for (let i = a.length - 1; i > 0; i--) {
        s         = (Math.imul(s, 1103515245) + 12345) >>> 0;
        const j   = s % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const questions = [];
let qid = 0;

/**
 * Add a question; options are shuffled deterministically.
 *
 * @param {"theoretical"|"practical"} type
 * @param {string} topic
 * @param {string} q
 * @param {string} correct
 * @param {string} w1
 * @param {string} w2
 * @param {string} w3
 */
function add(type, topic, q, correct, w1, w2, w3) {
    const opts   = shuffleDet([correct, w1, w2, w3], (qid + 1) * 7919);
    const answer = opts.indexOf(correct);
    if (answer < 0) throw new Error(`correct not found for id ${qid + 1}`);
    questions.push({ id: ++qid, type, topic, q, options: opts, answer });
}

const topicLabels = {
    basics:       "SQL fundamentals & clauses",
    joins:        "JOINs & relational combinations",
    aggregates:   "GROUP BY, aggregates & HAVING",
    subqueries:   "Subqueries & EXISTS / IN",
    window:       "Window functions & OVER",
    cte:          "CTEs & WITH",
    optimization: "Query tuning & patterns",
    indexes:      "Indexes & access paths",
    nulls:        "NULL handling & functions",
    dml_ddl:      "DML / DDL basics",
    set_ops:      "UNION / INTERSECT / EXCEPT",
};

/* Varied table & column names so each rotation of a pattern looks different. */
const T = [
    "orders","users","events","skus","sessions","payments","subs","tickets",
    "shipments","refunds","clicks","carts","accounts","campaigns","leads",
    "visitors","devices","regions","products","teams","invoices","coupons",
    "widgets","metrics","flags",
];
const C = [
    "user_id","order_id","amount","status","created_at","region","sku",
    "score","flag","tier","qty","price","kind","code","name",
];

// ─────────────────────────────────────────────────────────────────────────────
// THEORETICAL  (500 questions — 25 patterns × 20 rotations)
// ─────────────────────────────────────────────────────────────────────────────
for (let k = 0; k < 500; k++) {
    const t  = T[k % T.length];
    const t2 = T[(k + 9)  % T.length];
    const c  = C[k % C.length];
    const c2 = C[(k + 4)  % C.length];
    const p  = k % 25;

    switch (p) {
        case 0:
            add("theoretical","nulls",
                `What is wrong with this NULL predicate?\nSELECT * FROM ${t} WHERE ${c} = NULL;`,
                "Use IS NULL — `= NULL` evaluates to UNKNOWN, not TRUE",
                `Nothing; it returns rows where ${c} is NULL`,
                "NULL cannot appear after an equality operator",
                "The engine treats NULL as 0 for comparisons");
            break;
        case 1:
            add("theoretical","aggregates",
                `Why is this invalid in standard SQL?\nSELECT ${c}, ${c2}, COUNT(*) FROM ${t} GROUP BY ${c};`,
                `${c2} is not in GROUP BY and not functionally dependent on ${c}`,
                "COUNT(*) is not allowed alongside GROUP BY",
                "Two non-aggregate columns cannot precede COUNT",
                "GROUP BY must list every column in the table");
            break;
        case 2:
            add("theoretical","aggregates",
                `To filter groups where AVG(${c}) > 10, where should that condition go?\nSELECT ${c2}, AVG(${c}) FROM ${t} GROUP BY ${c2}`,
                `HAVING AVG(${c}) > 10 — after GROUP BY`,
                `WHERE AVG(${c}) > 10 — before GROUP BY`,
                "It cannot be expressed without a subquery",
                "LIMIT with a sort by AVG replaces the filter");
            break;
        case 3:
            add("theoretical","joins",
                `What does this LEFT JOIN guarantee?\nSELECT * FROM ${t} a LEFT JOIN ${t2} b ON a.${c} = b.${c};`,
                `Every row from ${t} appears; unmatched ${t2} columns are NULL`,
                "Only rows matching on both sides are returned",
                `Unmatched ${t2} rows are kept; matched ${t} rows are dropped`,
                "A Cartesian product is produced");
            break;
        case 4:
            add("theoretical","joins",
                `What does CROSS JOIN produce?\nSELECT * FROM ${t} CROSS JOIN ${t2};`,
                `Every row of ${t} paired with every row of ${t2} — Cartesian product`,
                "Only rows with equal primary keys",
                "An error unless an ON clause is provided",
                "Duplicate-free union of both tables");
            break;
        case 5:
            add("theoretical","basics",
                `In what logical order are the clauses processed?\nSELECT ${c} FROM ${t} WHERE ${c2} > 0 GROUP BY ${c} HAVING COUNT(*) > 1 ORDER BY ${c};`,
                "FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY",
                "SELECT → FROM → WHERE → GROUP BY",
                "WHERE → FROM → GROUP BY → HAVING",
                "ORDER BY is applied before GROUP BY");
            break;
        case 6:
            add("theoretical","set_ops",
                `How does UNION ALL differ from UNION?\n(SELECT ${c} FROM ${t}) UNION ALL (SELECT ${c} FROM ${t2});`,
                "UNION ALL keeps duplicate rows; UNION removes them",
                "UNION ALL removes duplicates; UNION keeps them",
                "UNION ALL requires identical column names",
                `UNION ALL sorts by ${c}; UNION does not`);
            break;
        case 7:
            add("theoretical","window",
                `What happens when ROW_NUMBER() has no ORDER BY inside OVER?\nSELECT ${c}, ROW_NUMBER() OVER (PARTITION BY ${c2}) rn FROM ${t};`,
                "Runs, but row order within each partition is non-deterministic",
                "Syntax error — ORDER BY is mandatory inside OVER",
                "Always numbers rows by physical storage order",
                "Behaves like RANK() with gaps");
            break;
        case 8:
            add("theoretical","window",
                `What does LAG(${c}, 1) return for each row?\nSELECT ${c2}, LAG(${c}, 1) OVER (ORDER BY ${c2}) prev FROM ${t};`,
                `The value of ${c} from the previous row in ORDER BY sequence`,
                "The value from the next row ahead",
                `A running sum of all prior ${c} values`,
                `The first ${c} in the partition for every row`);
            break;
        case 9:
            add("theoretical","subqueries",
                `When does EXISTS return TRUE?\nSELECT * FROM ${t} o WHERE EXISTS (SELECT 1 FROM ${t2} i WHERE i.${c} = o.${c});`,
                "When the subquery returns at least one row for that outer row",
                "When the subquery returns exactly one column",
                "When COUNT(*) inside the subquery exceeds zero",
                "When IN would return FALSE");
            break;
        case 10:
            add("theoretical","aggregates",
                `What is the difference between COUNT(${c}) and COUNT(*)?\nSELECT COUNT(${c}), COUNT(*) FROM ${t};`,
                `COUNT(${c}) skips NULLs; COUNT(*) counts every row`,
                "They are always identical",
                `COUNT(*) skips NULLs; COUNT(${c}) counts every row`,
                `COUNT(${c}) counts only distinct non-NULL values`);
            break;
        case 11:
            add("theoretical","nulls",
                "In SQL three-valued logic, what does NULL OR TRUE evaluate to?",
                "TRUE",
                "NULL",
                "FALSE",
                "UNKNOWN (a value distinct from NULL in the SQL standard)");
            break;
        case 12:
            add("theoretical","cte",
                `Can a later CTE reference an earlier one in the same WITH?\nWITH a AS (SELECT ${c} FROM ${t}),\n     b AS (SELECT * FROM a WHERE ${c} > 0)\nSELECT * FROM b;`,
                "Yes — b may reference a defined earlier in the same WITH",
                "No — CTEs cannot reference each other",
                "Only if both are declared RECURSIVE",
                `No — only base table ${t} may be referenced`);
            break;
        case 13:
            add("theoretical","optimization",
                `Why may wrapping a column in a function hurt performance?\nSELECT * FROM ${t} WHERE UPPER(${c}) = 'X';`,
                `Applying UPPER() to ${c} prevents a plain index seek on ${c}`,
                "UPPER() always improves index efficiency",
                "It forces the optimizer to use a sort-merge join",
                "Functions are required for case-insensitive searches");
            break;
        case 14:
            add("theoretical","dml_ddl",
                `What is the key difference between these two?\nTRUNCATE TABLE ${t};\nDELETE FROM ${t};`,
                "TRUNCATE removes all rows with minimal logging; DELETE is row-by-row and accepts a WHERE",
                "They are identical in all databases",
                "DELETE cannot use a WHERE clause",
                "TRUNCATE removes one row at a time");
            break;
        case 15:
            add("theoretical","joins",
                `What is the main risk with old-style implicit joins?\nSELECT * FROM ${t} a, ${t2} b WHERE a.${c} = b.${c};`,
                "Forgetting the WHERE condition produces a silent Cartesian product",
                "Old-style joins are always faster than explicit JOIN",
                "This syntax is illegal in SQL:1999+",
                "Cannot represent outer joins");
            break;
        case 16:
            add("theoretical","aggregates",
                "Is HAVING valid without GROUP BY?",
                "Often yes — the whole table is treated as one implicit group",
                "Always a syntax error in standard SQL",
                "Only valid when two or more tables appear in FROM",
                "HAVING without GROUP BY is the same as WHERE");
            break;
        case 17:
            add("theoretical","window",
                "How do RANK() and DENSE_RANK() differ after a tie?",
                "RANK leaves gaps after tied groups; DENSE_RANK uses consecutive integers",
                "They behave identically for all inputs",
                "DENSE_RANK leaves gaps; RANK does not",
                "Only RANK supports PARTITION BY");
            break;
        case 18:
            add("theoretical","subqueries",
                `When does a scalar subquery cause a runtime error?\nSELECT (SELECT ${c} FROM ${t}) AS x;`,
                "When the subquery returns more than one row",
                "When the subquery returns zero rows",
                "When the subquery contains GROUP BY",
                "When the outer query has no FROM clause");
            break;
        case 19:
            add("theoretical","indexes",
                `Composite index on (${c}, ${c2}) — which filter uses the index for a seek?`,
                `WHERE ${c} = ? — satisfies the leftmost-prefix rule`,
                `WHERE ${c2} = ? alone — skips the leading column`,
                `WHERE ${c2} LIKE '%x%' alone`,
                `ORDER BY ${c2} without any filter on ${c}`);
            break;
        case 20:
            add("theoretical","basics",
                `What does DISTINCT apply to here?\nSELECT DISTINCT ${c}, ${c2} FROM ${t};`,
                `The combined row (${c}, ${c2}) — the pair must be unique`,
                `Only the first column ${c}`,
                "Each column independently in two passes",
                "Primary-key rows only");
            break;
        case 21:
            add("theoretical","aggregates",
                `What does MAX return when no rows match?\nSELECT MAX(${c}) FROM ${t} WHERE ${c2} IS NULL; -- assume 0 rows match`,
                "NULL — aggregating an empty set returns NULL",
                "Zero rows are returned",
                "An error — MAX on empty set is undefined",
                "0 (zero)");
            break;
        case 22:
            add("theoretical","joins",
                "Why might an INNER JOIN return zero rows?",
                "No rows satisfy the ON predicate (including when NULLs prevent matches)",
                "INNER JOIN always returns at least one row",
                "NULL in ON always evaluates to TRUE",
                "INNER JOIN ignores the WHERE clause");
            break;
        case 23:
            add("theoretical","set_ops",
                `What does EXCEPT return?\n(SELECT ${c} FROM ${t}) EXCEPT (SELECT ${c} FROM ${t2});`,
                `Rows in ${t} not present in ${t2}`,
                `Rows present in both ${t} and ${t2}`,
                "All rows from both queries combined",
                `Rows in ${t2} not present in ${t}`);
            break;
        case 24:
            add("theoretical","window",
                `What does NTILE(4) do?\nSELECT ${c}, NTILE(4) OVER (ORDER BY ${c2}) q FROM ${t};`,
                "Splits ordered rows into 4 nearly equal-sized buckets (larger ones come first)",
                "Returns fractional percentiles 0.25 … 1.0",
                "Keeps only the top 4 rows",
                `Requires PARTITION BY ${c} or it errors`);
            break;
        default:
            throw new Error(`unknown theoretical pattern ${p}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRACTICAL  (500 questions — 25 patterns × 20 rotations)
// ─────────────────────────────────────────────────────────────────────────────
for (let k = 0; k < 500; k++) {
    const t  = T[k % T.length];
    const t2 = T[(k + 9)  % T.length];
    const c  = C[k % C.length];
    const c2 = C[(k + 4)  % C.length];
    const n1 = (k % 6) + 3;        // 3–8 rows for Cartesian scenarios
    const n2 = (k % 4) + 2;        // 2–5 rows
    const p  = k % 25;

    switch (p) {
        case 0:
            add("practical","nulls",
                `What does this query return?\nSELECT * FROM ${t}\nWHERE ${c} = NULL;`,
                `Zero rows — = NULL always evaluates to UNKNOWN`,
                `All rows where ${c} is NULL`,
                "A syntax error at runtime",
                `Same result as WHERE ${c} IS NOT NULL`);
            break;
        case 1:
            add("practical","aggregates",
                `Identify the problem:\nSELECT ${c}, ${c2}, COUNT(*)\nFROM ${t}\nGROUP BY ${c};`,
                `Error: ${c2} is in SELECT but not in GROUP BY`,
                "Valid — any column can appear alongside an aggregate",
                "Error: COUNT(*) cannot appear with a GROUP BY",
                "Error: GROUP BY must use an alias, not a column name");
            break;
        case 2:
            add("practical","aggregates",
                `What happens when you run this?\nSELECT ${c}, COUNT(*) n\nFROM ${t}\nWHERE COUNT(*) > 2\nGROUP BY ${c};`,
                "Error — aggregate functions are not allowed in WHERE; use HAVING",
                "Returns groups with count > 2 correctly",
                "Runs fine; WHERE filters rows before aggregation",
                "WHERE and HAVING are interchangeable here");
            break;
        case 3:
            add("practical","joins",
                `${t} has a row where ${c} = 999; ${t2} has no matching row.\nWhat appears in b.${c2} for that ${t} row?\nSELECT a.${c}, b.${c2}\nFROM ${t} a\nLEFT JOIN ${t2} b ON a.${c} = b.${c};`,
                `NULL — unmatched left rows are kept with NULL on the right side`,
                "The row is excluded from the result",
                "An error is raised for the unmatched key",
                `b.${c2} takes the column's default value`);
            break;
        case 4:
            add("practical","joins",
                `${t} has ${n1} rows; ${t2} has ${n2} rows.\nHow many rows does this return?\nSELECT * FROM ${t} CROSS JOIN ${t2};`,
                `${n1 * n2} — Cartesian product (${n1} × ${n2})`,
                `${n1} — only ${t} rows`,
                `${n1 + n2} — rows from both tables appended`,
                `${Math.min(n1, n2)} — only matching-key rows`);
            break;
        case 5:
            add("practical","basics",
                `Which clause is logically evaluated FIRST?\nSELECT ${c2}, COUNT(*) cnt\nFROM ${t}\nWHERE ${c} > 0\nGROUP BY ${c2}\nHAVING cnt > 1\nORDER BY cnt DESC;`,
                "FROM",
                "SELECT",
                "WHERE",
                "ORDER BY");
            break;
        case 6:
            add("practical","set_ops",
                `Both queries return the row (1, 'active').\nHow does UNION ALL handle the duplicate?\n(SELECT ${c} FROM ${t})\nUNION ALL\n(SELECT ${c} FROM ${t2});`,
                "Both copies are kept — UNION ALL never removes duplicates",
                "The duplicate is removed — UNION ALL deduplicates",
                "An error is raised for the duplicate row",
                "Only one of the two queries executes");
            break;
        case 7:
            add("practical","window",
                `Is the row numbering deterministic?\nSELECT ${c},\n       ROW_NUMBER() OVER (PARTITION BY ${c2}) rn\nFROM ${t};`,
                "No — without ORDER BY inside OVER, order within each partition is undefined",
                "Yes — partitions are always sorted by insertion order",
                "Yes — ROW_NUMBER is always deterministic",
                "Error — ORDER BY is required inside OVER with ROW_NUMBER");
            break;
        case 8:
            add("practical","window",
                `What is prev_${c} for the very first row in the ordering?\nSELECT ${c2},\n       ${c},\n       LAG(${c}) OVER (ORDER BY ${c2}) AS prev_${c}\nFROM ${t};`,
                `NULL — no preceding row exists for the first row`,
                `The value of ${c} for the last row in the table`,
                "0 (zero default when there is no previous row)",
                "An error is raised for the first row");
            break;
        case 9:
            add("practical","subqueries",
                `The inner WHERE always filters out every row.\nWhat does EXISTS return for each outer row?\nSELECT * FROM ${t} o\nWHERE EXISTS (\n  SELECT 1 FROM ${t2} i\n  WHERE i.${c} = o.${c} AND 1 = 0\n);`,
                "FALSE — EXISTS is false when the subquery returns no rows",
                "TRUE — EXISTS ignores the inner WHERE conditions",
                "NULL — three-valued logic makes this unknown",
                "Error — subquery must always return at least one row");
            break;
        case 10:
            add("practical","aggregates",
                `${t} has 6 rows; ${c} is NULL in 2 of them.\nWhat does this return?\nSELECT COUNT(*), COUNT(${c}) FROM ${t};`,
                `6, 4 — COUNT(*) counts all rows; COUNT(${c}) skips NULLs`,
                "4, 4 — both functions skip NULLs",
                "6, 6 — both functions count all rows",
                `Error — you cannot mix COUNT(*) and COUNT(${c})`);
            break;
        case 11:
            add("practical","nulls",
                "In SQL three-valued logic, what does NULL AND FALSE evaluate to?",
                "FALSE — AND with FALSE is always FALSE regardless of the other operand",
                "NULL",
                "TRUE",
                "UNKNOWN (distinct from NULL in the standard)");
            break;
        case 12:
            add("practical","cte",
                `Does this query run without error?\nWITH a AS (\n  SELECT ${c} FROM ${t}\n),\nb AS (\n  SELECT * FROM a WHERE ${c} > 0\n)\nSELECT * FROM b;`,
                "Yes — b can reference a defined earlier in the same WITH",
                "No — CTEs cannot reference each other",
                "No — WITH must contain exactly one named query",
                "Only if both CTEs are declared RECURSIVE");
            break;
        case 13:
            add("practical","optimization",
                `Why might this query NOT use an index on ${c}?\nSELECT * FROM ${t}\nWHERE UPPER(${c}) = 'ACTIVE';`,
                `UPPER() wraps ${c}, preventing an index seek on the raw column`,
                "UPPER() always improves index efficiency",
                "The optimizer always ignores scalar functions in WHERE",
                "Indexes do not work with string columns");
            break;
        case 14:
            add("practical","dml_ddl",
                `What is the key behavioural difference?\nA: TRUNCATE TABLE ${t};\nB: DELETE FROM ${t} WHERE ${c} IS NOT NULL;`,
                "B is row-by-row with a predicate and fully logged; A removes all rows with minimal logging",
                "Both statements are identical in every database",
                "A can be rolled back; B cannot",
                "B removes only non-NULL rows; A removes nothing");
            break;
        case 15:
            add("practical","joins",
                `${t} has ${n1} rows; ${t2} has ${n2} rows.\nThe ON / WHERE was accidentally omitted.\nHow many rows does this return?\nSELECT * FROM ${t} a, ${t2} b;`,
                `${n1 * n2} — Cartesian product from the missing join condition`,
                `${n1} — only ${t} rows`,
                `${n1 + n2} — rows from both tables appended`,
                "0 — missing WHERE means no rows pass");
            break;
        case 16:
            add("practical","aggregates",
                `Does this run, and what does it return?\nSELECT COUNT(*) cnt\nFROM ${t}\nHAVING COUNT(*) > 0;`,
                "Yes — the whole table is one implicit group; returns one row if any rows exist",
                "Error — HAVING requires a GROUP BY clause",
                `Error — COUNT(*) cannot appear in both SELECT and HAVING`,
                `Returns every row of ${t} filtered by the count`);
            break;
        case 17:
            add("practical","window",
                `Scores: 90, 90, 80, 70 ordered DESC.\nWhat is (RANK, DENSE_RANK) for the row with score = 80?\nSELECT score,\n       RANK()       OVER (ORDER BY score DESC) r,\n       DENSE_RANK() OVER (ORDER BY score DESC) dr\nFROM ${t};`,
                "(3, 2) — two rows tie at 1; RANK skips to 3, DENSE_RANK goes to 2",
                "(2, 2) — both functions agree after a tie",
                "(3, 3) — both leave a gap after a tie",
                "(2, 3) — DENSE_RANK skips; RANK does not");
            break;
        case 18:
            add("practical","subqueries",
                `${t2} has 3 rows. What happens when this runs?\nSELECT ${c},\n       (SELECT ${c2} FROM ${t2}) AS x\nFROM ${t};`,
                "Runtime error — scalar subquery returned more than one row",
                `The first row's ${c2} value is silently used`,
                `The query auto-aggregates ${t2} to one row`,
                `Three copies of each ${t} row are returned`);
            break;
        case 19:
            add("practical","indexes",
                `An index exists on (${c}, ${c2}).\nCan this query use that index for a seek?\nSELECT * FROM ${t}\nWHERE ${c2} = 'active';`,
                `No — filtering only ${c2} skips the leading column ${c}; leftmost-prefix rule not satisfied`,
                "Yes — composite indexes cover any subset of their columns equally",
                `Yes — ${c2} is in the index so seeks always work`,
                "No — composite indexes never speed up equality predicates");
            break;
        case 20:
            add("practical","basics",
                `How many distinct rows are returned?\n-- ${t} contains: (1,'a'), (1,'b'), (1,'a'), (2,'a')\nSELECT DISTINCT ${c}, ${c2} FROM ${t};`,
                `3 — DISTINCT deduplicates the (${c}, ${c2}) pair; (1,'a') appears once`,
                `2 — only unique values of the first column ${c}`,
                "4 — DISTINCT has no effect on two-column selects",
                `1 — DISTINCT keeps only the row with the lowest ${c}`);
            break;
        case 21:
            add("practical","aggregates",
                `No rows match the filter. What does MAX return?\nSELECT MAX(${c}) FROM ${t}\nWHERE 1 = 0;`,
                "One row with MAX = NULL",
                "Zero rows returned",
                "Error — MAX on an empty set is undefined",
                "One row with MAX = 0");
            break;
        case 22:
            add("practical","joins",
                `Both tables have rows where ${c} IS NULL.\nDo those NULL rows join with each other?\nSELECT *\nFROM ${t} a\nJOIN ${t2} b ON a.${c} = b.${c};`,
                "No — NULL = NULL is UNKNOWN, not TRUE; NULLs never match in a JOIN",
                "Yes — NULLs are treated as equal in ON conditions",
                "Only if both sides are NULL simultaneously (special NULL-safe rule)",
                "Yes — but only with INNER JOIN, not OUTER JOIN");
            break;
        case 23:
            add("practical","set_ops",
                `What rows does this return?\n(SELECT ${c} FROM ${t})\nEXCEPT\n(SELECT ${c} FROM ${t2});`,
                `Values in ${t} that do not appear in ${t2}`,
                `Values that appear in both ${t} and ${t2}`,
                `All values from both ${t} and ${t2}`,
                `Values in ${t2} that do not appear in ${t}`);
            break;
        case 24:
            add("practical","window",
                `${t} has 10 rows. What are the bucket sizes?\nSELECT ${c}, NTILE(4) OVER (ORDER BY ${c2}) bucket\nFROM ${t};`,
                "3, 3, 2, 2 — rows distributed as evenly as possible; larger buckets first",
                "2, 2, 3, 3 — smaller buckets come first",
                "4, 3, 2, 1 — strictly decreasing bucket sizes",
                "All 4 buckets have exactly 2 rows (remainder discarded)");
            break;
        default:
            throw new Error(`unknown practical pattern ${p}`);
    }
}

writeFileSync(
    OUT,
    JSON.stringify({ version: 4, topicLabels, questions }, null, 0)
);

const th = questions.filter((q) => q.type === "theoretical").length;
const pr = questions.filter((q) => q.type === "practical").length;
console.log(`Wrote ${questions.length} questions → ${OUT}`);
console.log(`  Theoretical: ${th}`);
console.log(`  Practical:   ${pr}`);
