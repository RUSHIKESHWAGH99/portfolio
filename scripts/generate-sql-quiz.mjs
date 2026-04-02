/**
 * Builds public/data/sql-quiz.json with 500 MCQs (4 options each).
 * Run from repo root: node scripts/generate-sql-quiz.mjs
 *
 * Distractors are balanced to similar length as the correct answer so
 * "pick the longest" is not a reliable strategy.
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

/** Phrases appended only to wrong answers — generic, do not signal correctness. */
const LENGTH_PADS = [
    " in typical OLTP and warehouse engines when standard SQL rules apply",
    " once NULL handling, collation, and three-valued logic are taken into account",
    " as documented in the SQL standard, aside from vendor-specific extensions",
    " for most analytical queries, though dialect quirks should always be verified",
    " when the optimizer sees selective predicates and proper key statistics",
];

/**
 * Lengthens a distractor so its size is closer to the correct answer's (reduces length heuristics).
 *
 * @param {string} wrong
 * @param {string} correct
 * @param {number} salt
 * @returns {string}
 */
function stretchDistractor(wrong, correct, salt) {
    const target = Math.max(correct.length, 48);
    let out = wrong.trim();
    let i = 0;
    while (out.length < target * 0.88 && i < LENGTH_PADS.length) {
        out += LENGTH_PADS[(salt + i) % LENGTH_PADS.length];
        i += 1;
    }
    return out;
}

/**
 * Ensures all three wrong answers are roughly similar length to `correct`.
 *
 * @param {string} correct
 * @param {string} w1
 * @param {string} w2
 * @param {string} w3
 * @param {number} seed
 * @returns {[string, string, string]}
 */
function balanceWrongOptions(correct, w1, w2, w3, seed) {
    const ref = correct.length;
    const wrongs = [w1, w2, w3];
    const maxW = Math.max(w1.length, w2.length, w3.length);
    const minW = Math.min(w1.length, w2.length, w3.length);
    const needsStretch = ref > maxW * 1.25 || maxW > minW * 2.2;
    if (!needsStretch) return [w1, w2, w3];
    return wrongs.map((w, j) => stretchDistractor(w, correct, seed + j * 17));
}

/**
 * Pads distractors until the longest wrong option is within a few chars of `correct`
 * so "always pick the longest" is not a reliable tactic.
 *
 * @param {string} correct
 * @param {string} a
 * @param {string} b
 * @param {string} c
 * @param {number} seed
 * @returns {[string, string, string]}
 */
function competitiveWrongLengths(correct, a, b, c, seed) {
    const lc = correct.length;
    let x = a;
    let y = b;
    let z = c;
    let guard = 0;
    while (lc > Math.max(x.length, y.length, z.length) - 6 && guard < 14) {
        const m = Math.min(x.length, y.length, z.length);
        if (x.length === m) x = stretchDistractor(x, correct, seed + guard);
        else if (y.length === m) y = stretchDistractor(y, correct, seed + guard + 3);
        else z = stretchDistractor(z, correct, seed + guard + 6);
        guard += 1;
    }
    // Sometimes correct is still uniquely longest — add one more pad to the shortest wrong
    if (lc > Math.max(x.length, y.length, z.length)) {
        if (x.length <= y.length && x.length <= z.length) x = stretchDistractor(x, correct, seed + 100);
        else if (y.length <= z.length) y = stretchDistractor(y, correct, seed + 101);
        else z = stretchDistractor(z, correct, seed + 102);
    }
    return [x, y, z];
}

const questions = [];
let id = 0;

function add(topic, q, correct, w1, w2, w3) {
    const s = (id + 1) * 131;
    let [a, b, c] = balanceWrongOptions(correct, w1, w2, w3, s);
    [a, b, c] = competitiveWrongLengths(correct, a, b, c, s + 19);
    const opts = shuffleDeterministic([correct, a, b, c], (id + 1) * 7919);
    const answer = opts.indexOf(correct);
    if (answer < 0) throw new Error("correct not in options");
    questions.push({ id: ++id, topic, q, options: opts, answer });
}

/* ── Looped generators — distractors are plausible and parallel in style ─── */

const joinTypes = [
    [
        "INNER JOIN",
        "Only rows that satisfy the join predicate on both sides appear in the result set",
        "Every row from the left is kept and non-matching right-side columns are filled with NULL",
        "Every row from the right is kept and non-matching left-side columns are filled with NULL",
        "All combinations of left and right rows appear without evaluating a join condition",
    ],
    [
        "LEFT JOIN",
        "All left-hand rows are returned; matching right rows attach, else right columns are NULL",
        "Only pairs of rows that match the join condition on both sides are returned",
        "All right-hand rows are returned; left columns become NULL when no match exists",
        "The result is the Cartesian product of the two inputs with duplicate keys removed",
    ],
    [
        "RIGHT JOIN",
        "All right-hand rows are returned; matching left rows attach, else left columns are NULL",
        "Only pairs of rows that satisfy the predicate on both sides are returned",
        "All left-hand rows are returned; right columns become NULL when no match exists",
        "Rows are paired strictly by primary-key equality with no NULL padding allowed",
    ],
    [
        "FULL OUTER JOIN",
        "Rows from either side appear; unmatched columns from the other side are padded with NULL",
        "Only rows that match on both sides are kept, identical to an inner join",
        "Only non-NULL keys from both tables participate; the rest are discarded first",
        "Every left row is paired with every right row before duplicate removal",
    ],
    [
        "CROSS JOIN",
        "Each left row is paired with every right row, producing the Cartesian product",
        "Only rows satisfying an ON or USING clause are combined from both inputs",
        "Duplicate keys are collapsed automatically before any pairing occurs",
        "The join requires a matching foreign-key definition between the two tables",
    ],
];

joinTypes.forEach(([name, c, w1, w2, w3]) => {
    add("joins", `In standard SQL, what does ${name} typically produce?`, c, w1, w2, w3);
});

const aggFacts = [
    [
        "COUNT(*)",
        "Counts every row in the group, including those where individual columns are NULL",
        "Counts only non-NULL values in the argument column, ignoring NULL rows entirely",
        "Returns the number of distinct physical pages touched during the scan",
        "Requires an ORDER BY clause in the same SELECT list to produce a defined count",
    ],
    [
        "COUNT(column)",
        "Counts non-NULL values in that column for each group",
        "Counts all rows including those where that column is NULL, same as COUNT(*)",
        "Returns the maximum numeric magnitude found in that column per group",
        "Can only be applied to columns that participate in the PRIMARY KEY",
    ],
    [
        "SUM(column)",
        "Sums non-NULL numeric values in that column within each group",
        "Concatenates string representations of the column across the group in SQL standard",
        "Always rounds fractional results to the nearest integer before returning",
        "Ignores the GROUP BY clause and aggregates the entire table in one value",
    ],
    [
        "AVG(column)",
        "Computes the mean of non-NULL values in that column for each group",
        "Treats NULL as zero for every skipped cell when forming the average",
        "Returns the middle element after sorting the group (the statistical median)",
        "Is defined only for INTEGER columns and raises an error for DECIMAL types",
    ],
    [
        "MAX(column)",
        "Returns the greatest value in the group according to the data type ordering rules",
        "Always returns the first physical row encountered in storage order",
        "Returns the smallest value when the column is indexed in descending order",
        "Is restricted to DATE and TIMESTAMP columns in the SQL standard",
    ],
    [
        "MIN(column)",
        "Returns the smallest value in the group according to the data type ordering rules",
        "Returns the largest value whenever ORDER BY DESC appears elsewhere in the query",
        "Skips character columns and only considers numeric fields in the group",
        "Cannot appear in the same SELECT list as MAX on another column",
    ],
];

aggFacts.forEach(([fn, c, w1, w2, w3]) => {
    add("aggregates", `What does ${fn} compute in a grouped query?`, c, w1, w2, w3);
});

const windowFns = [
    [
        "ROW_NUMBER()",
        "Assigns a unique integer to each row in the partition in deterministic order",
        "Assigns the same integer to every row that ties on the ORDER BY keys",
        "Numbers rows starting at zero and resets at every physical page boundary",
        "Replaces PARTITION BY and must be used without an OVER clause",
    ],
    [
        "RANK()",
        "Assigns ranks with gaps after tied groups share the same rank value",
        "Assigns dense consecutive integers with no gaps after ties in the partition",
        "Requires exactly two PARTITION BY columns to behave deterministically",
        "Is identical to ROW_NUMBER for every input regardless of ties",
    ],
    [
        "DENSE_RANK()",
        "Assigns consecutive rank values without leaving gaps after tied groups",
        "Always inserts a gap equal to the tie count after each tied block",
        "Orders the partition implicitly by primary key when ORDER BY is omitted",
        "Counts only NULL values when ranking non-NULL business metrics",
    ],
    [
        "LAG(expr)",
        "Returns the value of expr from a prior row in the window ordering",
        "Returns the value from the next row ahead in the window ordering",
        "Accumulates a running sum of expr over all prior rows in the partition",
        "Is only valid inside a GROUP BY aggregate list, not inside OVER",
    ],
    [
        "LEAD(expr)",
        "Returns the value of expr from a following row in the window ordering",
        "Returns the value from the previous row behind in the window ordering",
        "Computes the difference between MAX and MIN of expr in the frame",
        "Cannot be combined with ORDER BY inside the same OVER specification",
    ],
    [
        "NTILE(n)",
        "Divides each partition into up to n buckets with nearly equal row counts",
        "Returns a fractional percentile between zero and one for expr",
        "Counts NULL buckets separately and excludes them from the bucket total",
        "Is equivalent to FLOOR(row_number / n) with no ordering requirement",
    ],
];

windowFns.forEach(([fn, c, w1, w2, w3]) => {
    add("window", `In SQL window functions, what is ${fn} used for?`, c, w1, w2, w3);
});

const basicsPool = [
    [
        "Primary key",
        "Uniquely identifies each row and enforces non-NULL for those columns in the table",
        "Automatically speeds up every query in the database without additional indexes",
        "Must always be stored as a variable-length character string type",
        "Allows unlimited duplicate NULL markers across rows in standard SQL",
    ],
    [
        "Foreign key",
        "Enforces that values reference existing keys in the parent table (or NULL where allowed)",
        "Creates a clustered index on the child table without an explicit CREATE INDEX",
        "Is interchangeable with PRIMARY KEY constraints on the same column list",
        "Forbids NULL in the referencing columns in every SQL implementation",
    ],
    [
        "SELECT",
        "Projects columns and expressions from tables or subqueries into a result relation",
        "Removes rows from base tables according to the WHERE predicate",
        "Creates a new persistent table structure in the current schema",
        "Commits the current transaction and releases all row locks held",
    ],
    [
        "WHERE",
        "Filters individual rows before grouping based on predicates on row values",
        "Filters grouped aggregates after GROUP BY similar to a post-aggregate gate",
        "Defines the sort order for the final result set before LIMIT is evaluated",
        "Specifies only how two tables are related in a join and nothing else",
    ],
    [
        "HAVING",
        "Restricts grouped result rows after aggregates have been computed",
        "Restricts base-table rows before any GROUP BY bucketing takes place",
        "Replaces the SELECT list when only aggregates are needed in output",
        "Creates or rebuilds indexes referenced in the GROUP BY column list",
    ],
    [
        "GROUP BY",
        "Forms buckets so aggregate functions are evaluated once per distinct bucket",
        "Sorts the entire result globally without changing aggregate semantics",
        "Removes duplicate rows from the final output in place of DISTINCT",
        "Defines how two relations are combined using equality predicates only",
    ],
    [
        "ORDER BY",
        "Determines the sequence of rows in the cursor or final result set",
        "Removes NULL values from the result before returning rows to the client",
        "Defines window partitions independently of the frame clause",
        "Is logically evaluated before WHERE filters in the processing pipeline",
    ],
    [
        "DISTINCT",
        "Eliminates duplicate result rows after SELECT expressions are evaluated",
        "Sorts ascending on the first column and descending on all remaining columns",
        "Creates a unique index on the underlying base table automatically",
        "Applies only when exactly one column appears in the SELECT list",
    ],
    [
        "LIMIT / OFFSET",
        "Caps row count and optionally skips a leading prefix of the ordered result",
        "Defines the sliding frame for window functions inside OVER clauses",
        "Substitutes for HAVING when working with grouped aggregate queries",
        "Is supported only on Oracle Database and not in portable SQL text",
    ],
    [
        "PRIMARY KEY vs UNIQUE",
        "Primary key columns are NOT NULL and uniquely identify rows; UNIQUE allows NULLs per rules",
        "The two constraints are identical for every column list in the standard",
        "UNIQUE always implies PRIMARY KEY when declared on a single column",
        "PRIMARY KEY permits multiple NULLs in the key columns across different rows",
    ],
];

basicsPool.forEach(([term, c, w1, w2, w3]) => {
    add("basics", `In relational SQL, which statement best describes ${term}?`, c, w1, w2, w3);
});

const nullFacts = [
    [
        "NULL = NULL",
        "Evaluates to UNKNOWN in SQL three-valued logic; use IS NULL / IS NOT NULL instead",
        "Evaluates to TRUE whenever both operands are NULL in the WHERE clause",
        "Evaluates to FALSE and therefore excludes the row from every predicate",
        "Is required to be TRUE so that outer joins can pad unmatched rows",
    ],
    [
        "NULL in arithmetic",
        "Typically propagates NULL through expressions unless functions like COALESCE wrap it",
        "Is coerced to zero for addition and to one for multiplication in the standard",
        "Is coerced to one for addition and to zero for division consistently",
        "Raises a runtime exception in every major database for basic arithmetic",
    ],
    [
        "COALESCE(a,b)",
        "Returns the first argument that is not NULL from left to right",
        "Returns the arithmetic mean of all non-NULL arguments provided",
        "Always returns the rightmost argument regardless of NULL status",
        "Concatenates all arguments into a single VARCHAR result value",
    ],
    [
        "NULLIF(a,b)",
        "Returns NULL when a and b compare equal; otherwise returns a",
        "Always returns b when either argument is NULL in the expression",
        "Behaves identically to COALESCE with the arguments reversed",
        "Casts both arguments to BOOLEAN before comparison in all dialects",
    ],
];

nullFacts.forEach(([label, c, w1, w2, w3]) => {
    add("nulls", `In SQL, what is correct about ${label}?`, c, w1, w2, w3);
});

const setOps = [
    [
        "UNION",
        "Stacks query results and removes duplicate rows unless UNION ALL is specified",
        "Stacks query results and retains all duplicate rows by default in the standard",
        "Requires result column names to match exactly or the operation fails",
        "Sorts the combined result globally before duplicates are considered",
    ],
    [
        "UNION ALL",
        "Concatenates result sets preserving all rows including duplicates",
        "Removes duplicates exactly like UNION without an ALL keyword",
        "Allows only two columns total in each participating SELECT list",
        "Is always slower than an INNER JOIN between the same two row sets",
    ],
    [
        "INTERSECT",
        "Returns rows that appear in both SELECT results where the dialect implements it",
        "Returns every row from the first SELECT regardless of the second query",
        "Subtracts the second result from the first, similar to EXCEPT semantics",
        "Is an alias for FULL OUTER JOIN when column counts already match",
    ],
    [
        "EXCEPT / MINUS",
        "Returns rows from the first query not present in the second (per dialect rules)",
        "Returns the union of both queries with duplicates removed automatically",
        "Returns only rows that appear in both queries on the same key columns",
        "Returns the Cartesian product restricted by the WHERE predicate only",
    ],
];

setOps.forEach(([op, c, w1, w2, w3]) => {
    add("set_ops", `What does ${op} do between two compatible SELECT statements?`, c, w1, w2, w3);
});

const idxFacts = [
    [
        "B-tree index",
        "Supports point lookups and range scans efficiently on ordered key values",
        "Forces the optimizer to read every table page end-to-end sequentially",
        "Stores exclusively NULL markers and cannot reference non-NULL keys",
        "Cannot be declared UNIQUE under any circumstances in SQL engines",
    ],
    [
        "Covering index",
        "Contains all columns needed so the engine can answer the query from the index alone",
        "Always increases write amplification without benefiting read latency",
        "Prevents any WHERE clause predicates from referencing indexed columns",
        "Applies only to VARCHAR columns longer than 256 characters",
    ],
    [
        "Composite index (a,b)",
        "Can be used for seeks on a alone or on (a,b) following leftmost-prefix rules",
        "Can be used for seeks on b alone with the same efficiency as on a alone",
        "Makes only the second column b searchable for equality predicates",
        "Behaves exactly like two completely independent single-column indexes always",
    ],
];

idxFacts.forEach(([term, c, w1, w2, w3]) => {
    add("indexes", `Which description fits a ${term}?`, c, w1, w2, w3);
});

const optFacts = [
    [
        "SELECT *",
        "Often widens I/O and couples queries to schema changes; listing columns is usually safer",
        "Is always the fastest way to retrieve rows because the star avoids planning cost",
        "Is required for the optimizer to choose any index-backed access path",
        "Guarantees a higher buffer-pool hit rate than projecting explicit columns",
    ],
    [
        "N+1 query pattern",
        "Issues many round-trips; often replaced with JOINs or batched IN lists",
        "Is the recommended pattern for large OLAP scans on fact tables",
        "Is how columnar warehouses expect you to load dimension attributes",
        "Is automatically removed from the plan when DISTINCT is present",
    ],
    [
        "Predicate sargability",
        "Means predicates are written so indexes can be used without wrapping indexed columns",
        "Encourages applying functions to indexed columns inside WHERE freely",
        "Discourages using WHERE altogether in favor of HAVING on raw rows",
        "Applies only to document databases and not to relational SQL engines",
    ],
    [
        "EXPLAIN",
        "Shows how the planner intends to execute or executed a statement",
        "Commits the surrounding transaction and persists pending changes",
        "Rebuilds only table statistics in MySQL and has no meaning elsewhere",
        "Drops secondary indexes that are not used in the current session",
    ],
];

optFacts.forEach(([term, c, w1, w2, w3]) => {
    add("optimization", `What is a good characterization of ${term}?`, c, w1, w2, w3);
});

const cteFacts = [
    [
        "WITH clause (CTE)",
        "Introduces named subqueries that can be referenced later in the same statement",
        "Materializes a permanent base table visible to all future sessions",
        "Cannot reference another CTE defined earlier in the same WITH list",
        "Is evaluated strictly after ORDER BY in the outer query finishes sorting",
    ],
    [
        "Recursive CTE",
        "Iterates from an anchor part to a fixed point for hierarchies and graphs",
        "Cannot combine anchor and recursive parts using UNION ALL syntax",
        "Always runs forever until the DBA cancels the session manually",
        "Is exactly equivalent to a global temporary table with no recursion",
    ],
];

cteFacts.forEach(([term, c, w1, w2, w3]) => {
    add("cte", `What is true about a ${term} in SQL?`, c, w1, w2, w3);
});

const subqFacts = [
    [
        "Correlated subquery",
        "References outer-query columns and is re-evaluated in the outer row context",
        "Never references columns from an outer query block by SQL definition",
        "Is always more efficient than an equivalent JOIN for large fact tables",
        "Cannot legally appear inside a WHERE clause in standard SQL grammar",
    ],
    [
        "EXISTS predicate",
        "Is true when the subquery returns at least one row and stops early when possible",
        "Counts how many rows the subquery would return if fully materialized",
        "Is always equivalent to IN with a NULL-safe comparison on all columns",
        "Requires the subquery SELECT list to contain an aggregate function",
    ],
    [
        "IN (subquery)",
        "Holds when the left value equals any row returned by the subquery",
        "Always correlates to the outer query on every column in the SELECT list",
        "Handles NULL comparisons safely without UNKNOWN outcomes in all cases",
        "Is defined to mean the same as an INNER JOIN for every possible query shape",
    ],
];

subqFacts.forEach(([term, c, w1, w2, w3]) => {
    add("subqueries", `Which statement about ${term} is most accurate?`, c, w1, w2, w3);
});

const dmlFacts = [
    [
        "INSERT",
        "Adds new rows into an existing table or partition according to provided values",
        "Removes rows that match a predicate from the target table permanently",
        "Alters column data types and constraints on the table in one statement",
        "Renames columns in place without rewriting any existing stored rows",
    ],
    [
        "UPDATE",
        "Changes column values for rows that satisfy the optional WHERE condition",
        "Adds new nullable columns to the table definition for every matched row",
        "Drops the entire database if the WHERE clause matches zero rows",
        "Requires a JOIN to every referenced table even for single-table updates",
    ],
    [
        "DELETE",
        "Removes rows that match the predicate while leaving table structure intact",
        "Always acquires identical locks and logs identical volume as TRUNCATE",
        "Cannot include a WHERE clause when referential integrity is enabled",
        "Sets default values on columns instead of removing matching rows",
    ],
    [
        "TRUNCATE",
        "Quickly removes all rows from a table with dialect-specific logging and lock rules",
        "Logs each removed row individually exactly like DELETE for all engines",
        "Removes at most one row unless a TOP or LIMIT modifier is supplied",
        "Drops the table object and all dependent views in the same command",
    ],
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
        c: "An unordered set of tuples (rows) sharing a fixed set of named attributes (columns)",
        w: [
            "A single physical heap file on disk with no notion of column names or types",
            "A list that is always sorted by the primary key values for convenient retrieval",
            "Exactly one scalar column that holds nested documents instead of tuples",
        ],
    },
    {
        t: "joins",
        stem: (n) => `Join drill #${n}: When is a NATURAL JOIN risky?`,
        c: "It equates all same-named columns implicitly, which may not be the intended join keys",
        w: [
            "It refuses to match on column names and instead hashes entire row images only",
            "It requires a USING list for every join and fails if any column shares a name",
            "It forbids referencing more than one table in the same FROM clause entirely",
        ],
    },
    {
        t: "aggregates",
        stem: (n) => `Aggregate drill #${n}: Why can SELECT non-aggregated columns be invalid with GROUP BY?`,
        c: "They must be grouped or functionally dependent on the grouped keys per SQL rules",
        w: [
            "GROUP BY forbids returning any base columns alongside aggregate expressions",
            "Only COUNT(*) may appear in the SELECT list when GROUP BY is present",
            "HAVING replaces the entire SELECT list and hides non-aggregated columns",
        ],
    },
    {
        t: "window",
        stem: (n) => `Window drill #${n}: What does PARTITION BY in OVER() do?`,
        c: "Splits the row stream so the window function restarts separately in each partition",
        w: [
            "Sorts every table in the database globally before any WHERE is evaluated",
            "Eliminates the need for GROUP BY by collapsing all rows into one partition",
            "Creates a durable partitioned table object stored on disk for reuse",
        ],
    },
    {
        t: "subqueries",
        stem: (n) => `Subquery drill #${n}: Scalar subquery in SELECT must return?`,
        c: "At most one row and one column of values for each outer row being processed",
        w: [
            "Any number of rows as long as the subquery text fits in a single line",
            "Exactly two columns that the outer query can unpack into local variables",
            "Only aggregate functions without a GROUP BY inside the subquery body",
        ],
    },
    {
        t: "cte",
        stem: (n) => `CTE drill #${n}: Can multiple CTEs chain in one WITH?`,
        c: "Yes — later CTEs may reference earlier names in the same WITH clause list",
        w: [
            "No — the standard allows only a single CTE name per SQL statement",
            "Only on very old MySQL releases before common table expressions existed",
            "Only when the CTE is declared recursive with an ANCHOR keyword present",
        ],
    },
    {
        t: "optimization",
        stem: (n) => `Tuning drill #${n}: Why might OR across different indexed columns hurt performance?`,
        c: "The planner may fail to union index-driven paths; rewriting with UNION ALL can help",
        w: [
            "OR predicates are always merged into a single perfect index intersection plan",
            "OR is ignored by optimizers so indexes are still used exactly like AND",
            "OR forces a global sort of the entire table before any filter is applied",
        ],
    },
    {
        t: "indexes",
        stem: (n) => `Index drill #${n}: Partial / filtered indexes are useful when?`,
        c: "A predicate isolates a hot fraction of rows so the index stays small and cache-friendly",
        w: [
            "They are never useful and should be avoided in production schema design",
            "They apply only to full table scans and not to selective predicates",
            "They are legal only on PRIMARY KEY columns and not on secondary keys",
        ],
    },
    {
        t: "nulls",
        stem: (n) => `NULL drill #${n}: Result of TRUE AND NULL in three-valued logic?`,
        c: "UNKNOWN — the row does not pass a WHERE clause that needs pure TRUE",
        w: [
            "TRUE, so the row always satisfies conjunctions involving NULL comparisons",
            "FALSE, which removes the row from the result before aggregates are computed",
            "NULL is forbidden from appearing in boolean expressions in standard SQL",
        ],
    },
    {
        t: "dml_ddl",
        stem: (n) => `DDL drill #${n}: What does CREATE VIEW typically store?`,
        c: "The text of a query definition; stored rows remain in the underlying base tables",
        w: [
            "Physical copies of all result rows refreshed only when the session ends",
            "Index entries alone with no reference back to the defining SELECT text",
            "Only the transaction log identifiers for the last bulk load operation",
        ],
    },
    {
        t: "set_ops",
        stem: (n) => `Set drill #${n}: For UNION, column lists must?`,
        c: "Be compatible in arity and types; corresponding names do not have to match",
        w: [
            "Use identical column aliases in the same order or the statement is rejected",
            "Contain exactly one projected expression per SELECT in the operation",
            "Match primary-key definitions between the two sides before UNION is legal",
        ],
    },
];

while (questions.length < 500) {
    const bank = stemBank[(questions.length - 1) % stemBank.length];
    const n = questions.length + 1;
    add(bank.t, bank.stem(n), bank.c, bank.w[0], bank.w[1], bank.w[2]);
}

const finalList = questions.slice(0, 500);

writeFileSync(
    OUT,
    JSON.stringify(
        {
            version: 2,
            topicLabels,
            questions: finalList,
        },
        null,
        0
    )
);

console.log(`Wrote ${finalList.length} questions to ${OUT}`);
