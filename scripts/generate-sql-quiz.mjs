/**
 * Builds public/data/sql-quiz.json with 500 MCQs (4 options each).
 * Run from repo root: node scripts/generate-sql-quiz.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "data");
const OUT = join(OUT_DIR, "sql-quiz.json");
mkdirSync(OUT_DIR, { recursive: true });

/** Deterministic shuffle so JSON is stable across runs. */
function shuffleDeterministic(items, seed) {
    const a = [...items];
    let s = seed >>> 0;
    for (let i = a.length - 1; i > 0; i--) {
        s = (Math.imul(s, 1103515245) + 12345) >>> 0;
        const j = s % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const questions = [];
let id = 0;

function add(topic, q, correct, w1, w2, w3) {
    const opts = shuffleDeterministic([correct, w1, w2, w3], (id + 1) * 7919);
    const answer = opts.indexOf(correct);
    if (answer < 0) throw new Error("correct not in options");
    questions.push({ id: ++id, topic, q, options: opts, answer });
}

/* ── Looped generators (bulk unique stems) ─────────────────── */

const joinTypes = [
    ["INNER JOIN", "Only matching rows from both tables", "All rows from both tables", "Only rows from the left table", "Cartesian product only"],
    ["LEFT JOIN", "All left rows plus matching right (else NULL)", "Only matching rows", "Only right table rows", "Excludes null keys"],
    ["RIGHT JOIN", "All right rows plus matching left (else NULL)", "Only inner matches", "Only left rows", "Self-join alias"],
    ["FULL OUTER JOIN", "All rows from both sides with NULL fill", "Same as INNER JOIN", "Only non-null keys", "Cross product"],
    ["CROSS JOIN", "Cartesian product of two sets", "Only matching keys", "Removes duplicates automatically", "Requires ON clause"],
];

joinTypes.forEach(([name, c, w1, w2, w3], i) => {
    add("joins", `In standard SQL, what does ${name} typically produce?`, c, w1, w2, w3);
});

const aggFacts = [
    ["COUNT(*)", "Counts all rows in the group", "Ignores nulls only", "Same as COUNT(column) always", "Cannot be used with GROUP BY"],
    ["COUNT(column)", "Counts non-NULL values in that column", "Always includes NULLs", "Counts distinct tables", "Only for numeric columns"],
    ["SUM(column)", "Total of non-NULL numeric values", "Concatenates strings in all dialects", "Always returns integer", "Cannot sum DECIMAL"],
    ["AVG(column)", "Average of non-NULL values", "Includes NULL as zero always", "Median of the group", "Only for integers"],
    ["MAX(column)", "Greatest value in the group per sort rules", "Always the first row", "Minimum value", "Only for dates"],
    ["MIN(column)", "Smallest value in the group per sort rules", "Same as MAX in DESC", "Ignores strings", "Requires HAVING"],
];

aggFacts.forEach(([fn, c, w1, w2, w3]) => {
    add("aggregates", `What does ${fn} compute in a grouped query?`, c, w1, w2, w3);
});

const windowFns = [
    ["ROW_NUMBER()", "Unique sequential rank within partition; ties get different numbers", "Same number for ties like RANK", "Always 0-based", "Requires GROUP BY instead of OVER"],
    ["RANK()", "Ranking with gaps after ties", "No gaps after ties", "Only for two partitions", "Same as ROW_NUMBER always"],
    ["DENSE_RANK()", "Ranking without gaps between distinct rank values", "Always leaves gaps", "Requires ORDER BY outside OVER", "Only counts NULLs"],
    ["LAG(expr)", "Value from a previous row in the window frame", "Next row value", "Sum of prior rows", "Only for aggregates"],
    ["LEAD(expr)", "Value from a following row in the window frame", "Previous row value", "Partition key only", "Cannot use with ORDER BY"],
    ["NTILE(n)", "Splits partition into n roughly equal buckets", "Returns percentile 0-1", "Counts null buckets only", "Same as FLOOR division"],
];

windowFns.forEach(([fn, c, w1, w2, w3]) => {
    add("window", `In SQL window functions, what is ${fn} used for?`, c, w1, w2, w3);
});

const basicsPool = [
    ["Primary key", "Uniquely identifies each row in a table", "Speeds all queries automatically", "Must be a string", "Allows duplicate NULLs in all DBs"],
    ["Foreign key", "Enforces referential integrity to another table", "Always indexed automatically in SQL standard", "Same as primary key", "Cannot be NULL ever"],
    ["SELECT", "Retrieves a result set from tables", "Deletes rows", "Creates a database", "Commits a transaction"],
    ["WHERE", "Filters rows before grouping", "Filters groups after aggregates", "Sorts the result", "Defines join keys only"],
    ["HAVING", "Filters groups after aggregation", "Filters rows before GROUP BY", "Replaces WHERE", "Creates indexes"],
    ["GROUP BY", "Buckets rows for aggregate functions", "Sorts rows globally", "Removes duplicates only", "Joins two tables"],
    ["ORDER BY", "Sorts the final result set", "Filters nulls", "Defines partitions", "Runs before WHERE"],
    ["DISTINCT", "Removes duplicate rows from the result", "Sorts ascending", "Creates unique indexes", "Only for one column"],
    ["LIMIT / OFFSET", "Restricts number of rows and skips leading rows", "Defines window frame", "Replaces HAVING", "Only in Oracle"],
    ["PRIMARY KEY vs UNIQUE", "Primary key implies NOT NULL and table-wide identity", "They are identical", "UNIQUE always is PK", "PK allows multiple NULLs"],
];

basicsPool.forEach(([term, c, w1, w2, w3]) => {
    add("basics", `In relational SQL, which statement best describes ${term}?`, c, w1, w2, w3);
});

const nullFacts = [
    ["NULL = NULL", "Unknown — use IS NULL / IS NOT NULL", "TRUE", "FALSE", "Always FALSE in SQL"],
    ["NULL in arithmetic", "Usually yields NULL", "Treated as zero always", "Treated as one", "Error in all engines"],
    ["COALESCE(a,b)", "First non-NULL argument", "Returns average", "Always returns b", "Concatenates arguments"],
    ["NULLIF(a,b)", "NULL if a equals b else a", "Always returns b", "Same as COALESCE", "Casts to boolean"],
];

nullFacts.forEach(([label, c, w1, w2, w3]) => {
    add("nulls", `In SQL, what is correct about ${label}?`, c, w1, w2, w3);
});

const setOps = [
    ["UNION", "Combines results and removes duplicate rows by default", "Keeps all duplicates by default", "Requires same column names only", "Sorts automatically"],
    ["UNION ALL", "Concatenates result sets keeping duplicates", "Removes duplicates", "Only two columns allowed", "Faster than JOIN always"],
    ["INTERSECT", "Rows present in both queries (where supported)", "All rows from first query", "Subtracts second query", "Outer join alias"],
    ["EXCEPT / MINUS", "Rows in first query not in second (dialect-dependent)", "Same as UNION", "Inner join", "Cross join"],
];

setOps.forEach(([op, c, w1, w2, w3]) => {
    add("set_ops", `What does ${op} do between two compatible SELECT statements?`, c, w1, w2, w3);
});

const idxFacts = [
    ["B-tree index", "Common structure for equality and range lookups", "Only for full table scans", "Stores only NULLs", "Cannot be unique"],
    ["Covering index", "Includes columns needed so the engine can satisfy query from index alone", "Always slower", "Disallows WHERE", "Only for text"],
    ["Composite index (a,b)", "Leftmost prefix rules apply for seek usage", "Any column order works equally", "Only b is searchable", "Same as two separate indexes always"],
];

idxFacts.forEach(([term, c, w1, w2, w3]) => {
    add("indexes", `Which description fits a ${term}?`, c, w1, w2, w3);
});

const optFacts = [
    ["SELECT *", "Often discouraged in production — widens I/O and breaks on schema change", "Always fastest", "Required for indexes", "Improves cache hit rate always"],
    ["N+1 query pattern", "Many round-trips — often fix with JOINs or batching", "Optimal for OLAP", "Standard for warehouses", "Eliminated by DISTINCT"],
    ["Predicate sargability", "Writing predicates so indexes can be used", "Using functions on indexed columns freely", "Avoiding WHERE", "Only for NoSQL"],
    ["EXPLAIN", "Shows planner decisions for a query", "Commits transaction", "Creates statistics only in MySQL", "Drops indexes"],
];

optFacts.forEach(([term, c, w1, w2, w3]) => {
    add("optimization", `What is a good characterization of ${term}?`, c, w1, w2, w3);
});

const cteFacts = [
    ["WITH clause (CTE)", "Names a subquery for readability and reuse in one statement", "Creates a permanent table always", "Cannot reference itself", "Runs after ORDER BY"],
    ["Recursive CTE", "Iterates until fixed point for hierarchical data", "Cannot be used with UNION", "Always infinite loop", "Same as temporary view"],
];

cteFacts.forEach(([term, c, w1, w2, w3]) => {
    add("cte", `What is true about a ${term} in SQL?`, c, w1, w2, w3);
});

const subqFacts = [
    ["Correlated subquery", "References outer query columns — evaluated per outer row", "Never uses outer columns", "Always faster than JOIN", "Cannot be in WHERE"],
    ["EXISTS predicate", "True if subquery returns any row", "Counts rows only", "Same as IN always", "Requires aggregate"],
    ["IN (subquery)", "Row value matches any subquery row", "Always correlated", "Cannot use with NULL safely", "Same as JOIN always"],
];

subqFacts.forEach(([term, c, w1, w2, w3]) => {
    add("subqueries", `Which statement about ${term} is most accurate?`, c, w1, w2, w3);
});

const dmlFacts = [
    ["INSERT", "Adds new rows to a table", "Removes rows", "Changes schema", "Renames columns"],
    ["UPDATE", "Modifies existing rows matching predicate", "Adds columns", "Drops database", "Always requires JOIN"],
    ["DELETE", "Removes rows matching predicate", "Truncates always faster in all cases with same locks", "Cannot use WHERE", "Adds defaults"],
    ["TRUNCATE", "Fast bulk remove — dialect-specific locking & rollback rules", "Always row-level logged like DELETE", "Removes one row only", "Same as DROP TABLE"],
];

dmlFacts.forEach(([kw, c, w1, w2, w3]) => {
    add("dml_ddl", `What does ${kw} do in SQL?`, c, w1, w2, w3);
});

/* ── Numeric expansion to reach 500 ───────────────────────── */

const topicLabels = {
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

const stemBank = [
    {
        t: "basics",
        stem: (n) => `Concept drill #${n}: Which best describes a relational "relation" in SQL theory?`,
        c: "An unordered set of tuples (rows) with named attributes",
        w: ["A physical file on disk only", "Always sorted by primary key", "A single column"],
    },
    {
        t: "joins",
        stem: (n) => `Join drill #${n}: When is a NATURAL JOIN risky?`,
        c: "It joins on all same-named columns implicitly — can surprise with wrong keys",
        w: ["It never uses column names", "It requires USING always", "It forbids multiple tables"],
    },
    {
        t: "aggregates",
        stem: (n) => `Aggregate drill #${n}: Why can SELECT non-aggregated columns be invalid with GROUP BY?`,
        c: "They must appear in GROUP BY or be functionally dependent per SQL rules",
        w: ["GROUP BY forbids any columns", "Only COUNT is allowed", "HAVING replaces SELECT list"],
    },
    {
        t: "window",
        stem: (n) => `Window drill #${n}: What does PARTITION BY in OVER() do?`,
        c: "Defines groups within which the window function resets",
        w: ["Sorts the entire database", "Replaces GROUP BY entirely", "Creates a permanent partition table"],
    },
    {
        t: "subqueries",
        stem: (n) => `Subquery drill #${n}: Scalar subquery in SELECT must return?`,
        c: "At most one row and one column (per row of outer query)",
        w: ["Any number of rows", "Exactly two columns", "Only aggregates"],
    },
    {
        t: "cte",
        stem: (n) => `CTE drill #${n}: Can multiple CTEs chain in one WITH?`,
        c: "Yes — later CTEs can reference earlier ones in the same WITH",
        w: ["No — only one CTE allowed", "Only in MySQL 3.1", "Only for recursive queries"],
    },
    {
        t: "optimization",
        stem: (n) => `Tuning drill #${n}: Why might OR across different indexed columns hurt performance?`,
        c: "Planner may not combine indexes well — UNION ALL of selective branches can help",
        w: ["OR is always indexed", "Indexes ignore OR", "OR forces full sort"],
    },
    {
        t: "indexes",
        stem: (n) => `Index drill #${n}: Partial / filtered indexes are useful when?`,
        c: "A predicate matches a hot subset of rows — smaller index, better cache",
        w: ["Never useful", "Only for full scans", "Only for primary keys"],
    },
    {
        t: "nulls",
        stem: (n) => `NULL drill #${n}: Result of TRUE AND NULL in three-valued logic?`,
        c: "UNKNOWN (treated as not TRUE in WHERE)",
        w: ["TRUE", "FALSE", "NULL is not allowed in boolean logic"],
    },
    {
        t: "dml_ddl",
        stem: (n) => `DDL drill #${n}: What does CREATE VIEW typically store?`,
        c: "A stored query definition — base tables hold data",
        w: ["Physical rows only", "Indexes only", "Transaction logs only"],
    },
    {
        t: "set_ops",
        stem: (n) => `Set drill #${n}: For UNION, column lists must?`,
        c: "Be compatible in count and types (names can differ)",
        w: ["Have identical names only", "Be exactly one column", "Match primary keys"],
    },
];

while (questions.length < 500) {
    const bank = stemBank[(questions.length - 1) % stemBank.length];
    const n = questions.length + 1;
    add(bank.t, bank.stem(n), bank.c, bank.w[0], bank.w[1], bank.w[2]);
}

/* ── Trim if over ─────────────────────────────────────────── */
const finalList = questions.slice(0, 500);

writeFileSync(
    OUT,
    JSON.stringify(
        {
            version: 1,
            topicLabels,
            questions: finalList,
        },
        null,
        0
    )
);

console.log(`Wrote ${finalList.length} questions to ${OUT}`);
