# Rushikesh Wagh — Portfolio

**[rushikeshwagh.vercel.app](https://rushikeshwagh.vercel.app)**

Product Analyst with 4+ years across Dunzo, FloBiz, and ALLEN Digital.  
This repo is the source for my personal portfolio — a static site (HTML / CSS / JS, no framework, no build step) with tabbed sections, in-browser analytics tools, and a SQL quiz on the Fun tab (optional email via Vercel + Resend).

---

## 🛠️ Free Analytics Tools

> **Tools tab → [rushikeshwagh.vercel.app/#tools](https://rushikeshwagh.vercel.app/#tools)**

Three utilities that run 100% in your browser. No sign-up, no AI, no backend, $0 infra — just deterministic math and static reference text.

---

### 1 · A/B Test Calculator

**Two-proportion z-test for conversion experiments.**

Paste in visitors and conversions for two variants, choose your significance level, and get:

| Output | Detail |
|---|---|
| Conversion rate A & B | Raw % |
| Rate difference | Percentage points (pp) |
| Relative lift | `(B − A) / A × 100` |
| z-statistic | Pooled SE formula |
| Two-sided p-value | Normal CDF via Abramowitz & Stegun erf approximation |
| Verdict | Significant at α = 0.10 / 0.05 / 0.01 |

No spreadsheet formula gymnastics. Paste numbers, click Calculate.

---

### 2 · Cohort Retention Heatmap

**Upload a CSV → instant colour-coded retention table.**

Expected format (wide):

```
cohort,week_0,week_1,week_2,week_3
Jan-2024,0.72,0.48,0.31,0.22
Feb-2024,0.68,0.44,0.29,0.19
Mar-2024,0.74,0.51,0.33,0.21
```

- Values ≤ 1 → treated as fractions, displayed as %
- Values > 1 (raw counts) → shading normalised **per column** so each period is independently readable
- Sticky first column + horizontal scroll for wide tables

Useful for spotting dropoff patterns without opening a Jupyter notebook or BI tool.

---

### 3 · SQL Formatter + Keyword Hints

**Paste messy SQL → get it indented by clause + a one-line reference blurb per keyword.**

Formats: `SELECT`, `FROM`, `WHERE`, `JOIN` (all variants), `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`, `OFFSET`, `WITH` (CTEs), `UNION` / `UNION ALL`

Hints are static, not AI-generated — same output every time, works offline.  
One-click copy to clipboard.

---

## Site Structure

| Tab | Content |
|---|---|
| **Home** | Hero, at-a-glance stats |
| **Journey** | About me, how I work, full experience timeline |
| **Tools** | A/B calculator, cohort heatmap, SQL formatter |
| **Projects** | 6 open-source ML & analytics repos |
| **Skills** | Tech stack |
| **Contact** | Links + resume |
| **Blogs** | Placeholder |
| **Fun** | SQL MCQ quiz (10 questions from a 500-question pool) |

---

## SQL quiz email (Vercel)

The Fun tab can email quiz results to the participant and BCC **rushikeshwagh43@gmail.com** using [Resend](https://resend.com).

1. Create a Resend API key and add it in Vercel → Project → Settings → Environment Variables:
   - `RESEND_API_KEY` — required
2. Optional overrides:
   - `RESEND_FROM` — e.g. `Portfolio Quiz <quiz@yourdomain.com>` (verify domain in Resend; `onboarding@resend.dev` only works for testing to verified addresses)
   - `QUIZ_OWNER_EMAIL` — defaults to rushikeshwagh43@gmail.com

Regenerate the question pool after editing `scripts/generate-sql-quiz.mjs`:

```bash
node scripts/generate-sql-quiz.mjs
```

---

## Stack

- **HTML / CSS / JS** — no framework, no build step, no npm for the static site
- **Vercel** — static files from `public/` plus `/api` serverless routes
- **Tools** — 100% client-side in the browser
- **SQL quiz email** — `api/send-quiz-email.js` + Resend

---

## Projects in the Portfolio

| Project | Type | Key Result |
|---|---|---|
| [Sales & Revenue Dashboard](https://github.com/RUSHIKESHWAGH99/Sales-Revenue-Dashboard) | Streamlit · BI | Discount-vs-profit analysis on Superstore data |
| [Telco Churn Prediction](https://github.com/RUSHIKESHWAGH99/Telco-Customer-Churn-Prediction) | Classification | Month-to-month contracts churn 3× more |
| [E-Commerce Sales Analysis](https://github.com/RUSHIKESHWAGH99/E-Commerce-Sales-Analysis) | EDA · Reporting | Top segments drive 80% of revenue |
| [Medical Insurance Cost Prediction](https://github.com/RUSHIKESHWAGH99/Medical-Insurance-Cost-Prediction) | Regression | Smokers pay 3.8× more |
| [Credit Card Fraud Detection](https://github.com/RUSHIKESHWAGH99/Credit-Card-Fraud-Detection) | Imbalanced · Classification | Recall-focused; 0.17% fraud rate |
| [Student Performance Prediction](https://github.com/RUSHIKESHWAGH99/Student-Performance-Prediction) | Classification | Prior grades + failures = strongest predictors |

---

## Contact

[LinkedIn](https://www.linkedin.com/in/rushikesh-wagh-08031999) · [GitHub](https://github.com/RUSHIKESHWAGH99) · rushikeshwagh43@gmail.com
