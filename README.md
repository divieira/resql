# reSQL

**ReSharper for SQL** - An intelligent SQL editor with real-time refactoring and smart completions.

> 📋 **See [PLAN.md](./PLAN.md) for the complete development roadmap and architecture details.**

## Phase 1: Auto GROUP BY ✅

Automatically adds `GROUP BY` clauses when you use aggregate functions with non-aggregated columns.

### Features

- ✅ **Real-time AST analysis** - Uses proper SQL parsing, not regex
- ✅ **Live transformation** - See changes as you type (300ms debounce)
- ✅ **Single textarea UI** - Simple, clean interface
- ✅ **Chinook database** - Test with real music store data
- ✅ **Aggregate detection** - Supports SUM, COUNT, MIN, MAX, AVG, and more

### How It Works

```sql
-- You type:
SELECT artist_name, COUNT(*) FROM artists

-- reSQL transforms it to:
SELECT artist_name, COUNT(*) FROM artists GROUP BY artist_name
```

The transformation happens automatically using AST introspection:
1. Parse SQL into an Abstract Syntax Tree
2. Walk the AST to detect aggregate functions
3. Identify non-aggregated columns
4. Add GROUP BY clause with those columns
5. Convert AST back to SQL

### Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

### Run Tests

```bash
npm test
```

### Project Structure

```
resql/
├── src/
│   ├── core/
│   │   └── auto-groupby.ts    # Auto GROUP BY logic with AST introspection
│   └── web/
│       ├── index.html         # Simple web UI
│       └── app.ts             # Real-time transformation + SQL execution
├── tests/
│   └── auto-groupby.test.ts   # Comprehensive tests
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### Try These Examples

```sql
-- Basic aggregate
SELECT Name, COUNT(*) FROM tracks

-- Multiple aggregates
SELECT AlbumId, SUM(Milliseconds), AVG(Milliseconds) FROM tracks

-- With WHERE clause
SELECT Composer, MIN(Milliseconds), MAX(Milliseconds)
FROM tracks
WHERE Composer IS NOT NULL
```

### Technology Stack

- **TypeScript** - Type safety for complex AST manipulation
- **node-sql-parser** - Multi-dialect SQL parser with AST support
- **sql.js** - SQLite compiled to WebAssembly (runs in browser)
- **Vite** - Fast development server and build tool
- **Vitest** - Unit testing framework

### Supported Aggregate Functions

- COUNT, SUM, AVG, MIN, MAX
- STDDEV, VARIANCE
- GROUP_CONCAT, STRING_AGG, ARRAY_AGG

### Roadmap

**Phase 2: SQLite Autocomplete** (Next)
- Table name suggestions
- Column name suggestions (context-aware)
- Keyword completions
- Simple dropdown UI

**Future Phases:**
- Clause navigation (bracket keys)
- Smart keyword movement
- Refactoring actions (Alt+Enter)
- Multi-database support
- CLI and VS Code extension

### Architecture Decisions

**Why TypeScript?**
- Runs everywhere: Node (CLI), Browser (Web), VS Code
- Strong typing for AST manipulation
- Best SQL editor libraries available

**Why AST introspection instead of regex?**
- Accurate detection of aggregate functions
- Handles nested expressions
- Works with complex queries
- Future-proof for more advanced features

**Why single textarea?**
- Simple, minimal UI
- Works on mobile
- No complex editor dependencies (yet)
- Fast development iteration

### Database Support

Currently optimized for **SQLite** dialect. The parser supports:
- MySQL, PostgreSQL, MariaDB
- BigQuery, Redshift, Snowflake
- DB2, Hive, TransactSQL

**Note:** Oracle is not supported by node-sql-parser. For Oracle support, consider [oracle-sql-parser](https://github.com/1ilit/oracle-sql-parser).

### Contributing

This is a minimal, incremental project. We add complexity gradually:
1. ✅ Auto GROUP BY (Phase 1)
2. 🚧 Autocomplete (Phase 2)
3. 📋 Navigation & Refactoring (Future)

Keep it simple!

### License

MIT
