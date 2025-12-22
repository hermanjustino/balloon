# Separating Display from Data: The React-as-Database Anti-Pattern

## Context

Built a React app (Balloon) to analyze dating show transcripts using Gemini AI. The front-end:
- Fetches all episodes from Firestore on load
- Calculates aggregates client-side (match rates, demographics)
- Stores the *only* queryable state in browser memory
- Has no way to export or query data outside the UI

This worked for ~10 episodes. Then I wanted to do real analysis:
- "What's the match rate by state?"
- "Do people with kids match more often?"
- "Which jobs correlate with success?"

**The UI could not answer these questions.** All the data was trapped in embedded JSON arrays.

The problem: I confused "having a database" with "having queryable data."

---

## Decision

**Phase 1 (What I Did Wrong)**:
- Put contestant arrays inside each episode document
- Pre-computed aggregates and stored them as separate docs
- Made the React app calculate everything on mount

**Phase 2 (The Fix)**:
1. **Normalize the data model**: Created separate `contestants` and `couples` collections with proper IDs
2. **Add relational references**: Couples reference contestants by UUID (enables SQL joins)
3. **Prepare for BigQuery**: Collections are now structured for streaming to a query engine

The key shift: **The database is not for the UI. The UI is one consumer of the database.**

---

## Tradeoff

### What I Gave Up:
**Speed to first render.**  
- Before: One Firestore query → all data in memory → instant charts
- After: Need to populate normalized collections, set up BigQuery, learn SQL patterns

**Simplicity of "just add it to Firestore."**  
- Before: New field? Just add it to the analysis document
- After: Need to think about normalization, foreign keys, denormalization tradeoffs

### What I Gained:
**The ability to ask questions the UI was never designed to answer.**  
- BigQuery: `SELECT state, COUNT(*) WHERE outcome = 'Matched' GROUP BY state`
- Joins: `SELECT c1.age, c2.age FROM couples JOIN contestants c1 ON...`
- Export: CSV, API, notebooks, Looker Studio

**A system that works like a real data platform.**  
- The React app is now just a thin display layer
- The data lives in a query engine
- The source of truth is versioned and exportable

---

## Lesson

**If your data only exists where your UI can see it, you don't have a data system.**

This is the React-as-Database anti-pattern. Symptoms:
- "How do I export this?"
- "Can I filter by X?"
- "What's the total across all records?"
- Answers all require writing new UI code

The fix:
1. **Normalize your writes**: Separate collections for entities that need querying
2. **Use a query engine**: BigQuery, PostgreSQL, something with SQL
3. **Treat the UI as read-only**: It should never be the source of truth

Google's guidance:
> "Storage is cheap. Queries are expensive. Design for the questions you'll ask, not the writes you'll make."

If you're calculating aggregates in React instead of SQL, you've built a data *viewer*, not a data *platform*.

The uncomfortable truth: this should have been obvious from day one. But it's easy to confuse "I can see the data" with "the data is queryable."

**Irreversible decision point**: Once you embed data in UI-only structures, migration is expensive. Start normalized.
