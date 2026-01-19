# reSQL Development Plan

**Vision:** reSQL is like ReSharper for SQL - an intelligent SQL editor with real-time refactoring and smart completions.

## Deployment Targets

- Standalone CLI
- Browser-based web UI
- VS Code extension

## Core Principles

- **Minimal & Incremental**: Start simple, add complexity gradually
- **Real-time Feedback**: Changes happen as you type (300ms debounce)
- **Multi-platform**: Same core logic works everywhere (TypeScript)
- **Test-Driven**: Comprehensive tests for all features

---

## Phase 1: Auto GROUP BY ✅ COMPLETE

**Status:** Shipped and deployed

### Features Implemented

1. ✅ **Real-time GROUP BY generation**
   - Detects aggregate functions using AST introspection (COUNT, SUM, MIN, MAX, AVG, etc.)
   - Automatically adds GROUP BY clause with non-aggregated columns
   - 300ms debounce for smooth typing experience

2. ✅ **Intelligent GROUP BY removal**
   - Removes GROUP BY when there are no aggregates
   - Removes GROUP BY when all columns are aggregates

3. ✅ **Clean SQL output**
   - Removes unnecessary quotes from identifiers
   - Keeps quotes for reserved keywords
   - Works with all SQL dialects (backticks, double quotes, square brackets)

4. ✅ **Web UI**
   - Dual-box interface (separate input/output)
   - Inline diff-based suggestions with Tab to accept
   - Visual feedback when SQL is transformed
   - Execute queries against Chinook database (SQLite WASM)
   - Mobile-friendly responsive design

5. ✅ **Chinook Database Integration**
   - SQLite WASM runs entirely in browser
   - Pre-loaded music store database (Track, Album, Artist, etc.)
   - Example queries for demonstration

### Bug Fixes Completed

- Bug #1: Switched to MySQL dialect to avoid double quotes (initially)
- Bug #2: Remove GROUP BY when query has only aggregate columns
- Bug #3: Use correct Chinook table names (Track vs tracks)
- Bug #4: Remove unnecessary quotes from identifiers
- Bug #5: Switch back to SQLite dialect + remove GROUP BY without aggregates

### Test Coverage

- **32 tests** covering all features and bug fixes
- AST introspection correctness
- Quote removal logic
- GROUP BY generation and removal
- Edge cases and integration tests

### Technology Stack

- **TypeScript** - Cross-platform compatibility
- **node-sql-parser** - Multi-dialect SQL parser (SQLite dialect)
- **sql.js** - SQLite WASM for browser execution
- **Vite** - Fast dev server and build tool
- **Vitest** - Unit testing framework

### Deployment

- GitHub Pages: https://divieira.github.io/resql/
- Automatic deployment via GitHub Actions

---

## Phase 2: SQLite Autocomplete 🚧 NEXT

**Goal:** Provide intelligent autocomplete suggestions as users type SQL queries.

### Features to Implement

1. **Schema-aware completions**
   - Extract schema from connected database (or Chinook demo)
   - Cache schema metadata for performance
   - Index tables, columns, and relationships

2. **Context-aware suggestions**
   - After SELECT: Suggest column names from tables in FROM clause
   - After FROM: Suggest table names
   - After WHERE: Suggest columns and operators
   - Inside JOIN: Suggest related columns based on foreign keys

3. **Keyword completions**
   - SQL keywords (SELECT, FROM, WHERE, GROUP BY, ORDER BY, etc.)
   - Aggregate functions (COUNT, SUM, AVG, MIN, MAX)
   - Common patterns (INNER JOIN, LEFT JOIN, etc.)

4. **Simple dropdown UI**
   - Show suggestions below textarea
   - Keyboard navigation (up/down arrows)
   - Filter as user types
   - Insert on Enter or Tab

5. **Ranking algorithm**
   - Fuzzy matching for typos
   - Prioritize by:
     - Prefix match
     - Recently used
     - Foreign key relationships
     - Alphabetical order

### Technical Implementation

```typescript
interface SchemaProvider {
  getTables(): Promise<Table[]>;
  getColumns(table: string): Promise<Column[]>;
  getRelationships(): Promise<ForeignKey[]>;
}

interface Completion {
  label: string;
  type: 'table' | 'column' | 'keyword' | 'function';
  detail?: string;
  score: number;
}

interface CompletionProvider {
  provideCompletions(
    query: string,
    cursorPosition: number,
    schema: SchemaInfo
  ): Completion[];
}
```

### Dependencies

- **fuzzysort** - Fast fuzzy search for completions
- Extend existing SchemaProvider from Phase 1

### Testing Strategy

- Unit tests for completion provider
- Context detection tests
- Ranking algorithm tests
- Integration tests with Chinook schema

---

## Phase 3: Clause Navigation 📋 PLANNED

**Goal:** Allow keyboard-based navigation between SQL clauses.

### Features to Implement

1. **Bracket key navigation**
   - `[` and `]` keys move between clause types
   - Jump to: SELECT → FROM → JOIN → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT
   - Wrap around at end/beginning

2. **Clause detection**
   - Parse query to identify clause boundaries
   - Maintain cursor position mapping
   - Visual indication of current clause

3. **Within-clause navigation**
   - Navigate between columns in SELECT
   - Navigate between conditions in WHERE (AND clauses)
   - Navigate between tables in JOIN

### Technical Implementation

```typescript
enum ClauseType {
  SELECT, FROM, JOIN, WHERE, GROUP_BY, HAVING, ORDER_BY, LIMIT
}

interface ClauseRegion {
  type: ClauseType;
  start: Position;
  end: Position;
}

function detectClauses(query: string): ClauseRegion[];
function navigateToNextClause(current: number, regions: ClauseRegion[]): number;
```

---

## Phase 4: Smart Keyword Movement 📋 PLANNED

**Goal:** Automatically move SQL keywords to correct positions as users type.

### Features to Implement

1. **Auto-repositioning**
   - User types "WHERE" anywhere in query
   - Automatically moves to correct position (after FROM/JOIN)
   - Similar for GROUP BY, ORDER BY, HAVING

2. **Visual feedback**
   - Show keyword being moved
   - Smooth cursor transition
   - Undo support

3. **Smart insertion**
   - Insert at correct position based on query structure
   - Respect existing clauses
   - Maintain proper SQL syntax

### Technical Implementation

```typescript
function repositionKeyword(
  query: string,
  keyword: string,
  cursorPos: number
): { sql: string, newCursorPos: number };
```

---

## Phase 5: Refactoring Actions (Alt+Enter) 📋 PLANNED

**Goal:** Provide quick refactoring actions similar to ReSharper.

### Features to Implement

1. **Convert to CTE (Common Table Expression)**
   - Extract subquery to WITH clause
   - Generate meaningful CTE name
   - Update references

   ```sql
   -- Before
   SELECT * FROM (SELECT id, name FROM users WHERE active = 1) u

   -- After (Alt+Enter on subquery)
   WITH active_users AS (
     SELECT id, name FROM users WHERE active = 1
   )
   SELECT * FROM active_users
   ```

2. **Extract to subquery**
   - Move complex expression to subquery
   - Add appropriate alias

3. **Inline subquery**
   - Reverse of extract - flatten nested queries
   - Useful for simple subqueries

4. **Create table alias**
   - Add meaningful alias to table
   - Update all column references

5. **Expand SELECT \***
   - Replace `*` with explicit column list
   - Use schema information

6. **Convert subquery to JOIN**
   - Identify correlated subqueries
   - Convert to INNER/LEFT JOIN
   - Improve performance

### Code Actions Framework

```typescript
interface CodeAction {
  title: string;
  kind: 'refactor' | 'quickfix';
  isApplicable(query: string, cursorPos: number): boolean;
  execute(): Promise<TextEdit[]>;
}

interface TextEdit {
  range: { start: number, end: number };
  newText: string;
}
```

---

## Phase 6: Multi-Database Support 📋 PLANNED

**Goal:** Support multiple database engines beyond SQLite.

### Features to Implement

1. **Connection management**
   - Store multiple database connections
   - Switch between connections
   - Test connection status

2. **Database-specific adapters**
   - PostgreSQL: Use `pg` driver + information_schema
   - MySQL: Use `mysql2` driver + information_schema
   - SQL Server: Use `mssql` driver + sys views
   - SQLite: Current implementation (sql.js for browser, better-sqlite3 for Node)

3. **Dialect-specific features**
   - PostgreSQL: RETURNING clause, array operators
   - MySQL: LIMIT syntax variations
   - SQL Server: TOP clause, square bracket identifiers

4. **Schema extraction per database**
   ```typescript
   interface DatabaseAdapter {
     connect(config: ConnectionConfig): Promise<void>;
     disconnect(): Promise<void>;
     getTables(): Promise<Table[]>;
     getColumns(table: string): Promise<Column[]>;
     getForeignKeys(): Promise<ForeignKey[]>;
     executeQuery(sql: string): Promise<QueryResult>;
   }
   ```

---

## Phase 7: CLI Tool 📋 PLANNED

**Goal:** Provide standalone command-line interface.

### Features to Implement

1. **Interactive REPL**
   - Read-Eval-Print-Loop for SQL queries
   - History (up/down arrows)
   - Multi-line input support
   - Syntax highlighting

2. **File execution**
   ```bash
   resql execute schema.sql
   resql format query.sql
   ```

3. **Database connection**
   ```bash
   resql connect postgresql://localhost/mydb
   resql connect --config ./database.json
   ```

4. **Terminal UI**
   - Use `ink` (React for CLI)
   - Split panes: query editor + results
   - Table formatting for results

### Technology Stack

- **Commander** - CLI argument parsing
- **ink** - React for terminal UIs
- **chalk** - Terminal colors
- **boxen** - Draw boxes around content

---

## Phase 8: VS Code Extension 📋 PLANNED

**Goal:** Full-featured VS Code extension with LSP support.

### Features to Implement

1. **Language Server Protocol (LSP)**
   - Reuse core logic from web/CLI
   - Standard LSP server implementation
   - Works with any LSP-compatible editor

2. **VS Code specific features**
   - Syntax highlighting (already exists, extend it)
   - IntelliSense (completions)
   - Code actions (refactoring)
   - Diagnostics (errors/warnings)
   - Hover information (table/column details)
   - Signature help (function parameters)

3. **Database explorer**
   - TreeView with database connections
   - Browse tables, columns, indexes
   - Right-click actions (generate SELECT, etc.)

4. **Query execution**
   - Run query from editor
   - Display results in output panel
   - Export to CSV/JSON

5. **Extension marketplace**
   - Package for VS Code marketplace
   - Auto-update support
   - Settings UI

### Project Structure

```
vscode-extension/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── client.ts             # LSP client
│   └── commands/             # VS Code commands
├── language-server/
│   └── server.ts             # LSP server (shared with other editors)
└── package.json              # Extension manifest
```

---

## Architecture Overview

### Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│           Presentation Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │   CLI    │  │  Web UI  │  │  VS Code Ext    │  │
│  └──────────┘  └──────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│         Language Server Protocol (LSP)              │
│  - Completions  - Diagnostics  - Code Actions       │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              Core Engine Layer                      │
│  ┌──────────────┐  ┌─────────────────────────┐     │
│  │ SQL Parser   │  │  Analysis Engine        │     │
│  │ (AST)        │  │  - Scope analysis       │     │
│  └──────────────┘  │  - Type inference       │     │
│                     │  - Refactoring engine   │     │
│                     └─────────────────────────┘     │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│         Database Abstraction Layer                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Postgres │ │  MySQL   │ │  SQLite  │  ...      │
│  │ Adapter  │ │ Adapter  │ │ Adapter  │           │
│  └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **TypeScript everywhere**
   - Core logic is portable across CLI, Web, and VS Code
   - Strong typing prevents bugs in complex AST manipulation
   - Excellent tooling support

2. **AST-based transformation**
   - node-sql-parser for parsing and code generation
   - AST walking for semantic analysis
   - No regex-based hacks

3. **SQLite for demo database**
   - sql.js (WASM) runs in browser without backend
   - Well-known Chinook dataset
   - Easy to showcase features

4. **Incremental complexity**
   - Start with dual-box UI (Phase 1) ✅
   - Add autocomplete (Phase 2)
   - Then advanced features (Phases 3-8)

5. **Test-driven development**
   - Comprehensive unit tests for core logic
   - Integration tests for UI interactions
   - E2E tests for full workflows

---

## Requirements Checklist

### Must Have (Phase 1) ✅

- [x] Auto GROUP BY generation
- [x] Real-time transformation
- [x] Dual-box web UI with inline suggestions
- [x] Chinook database demo
- [x] Clean SQL output (no unnecessary quotes)
- [x] Comprehensive tests

### Should Have (Phase 2)

- [ ] Table name autocomplete
- [ ] Column name autocomplete (context-aware)
- [ ] Keyword completions
- [ ] Dropdown UI for suggestions

### Nice to Have (Phase 3+)

- [ ] Bracket key navigation
- [ ] Smart keyword movement
- [ ] Refactoring actions (Alt+Enter)
- [ ] Multi-database support
- [ ] CLI tool
- [ ] VS Code extension

---

## Non-Goals

- ❌ Query optimization/planning
- ❌ Database administration features
- ❌ Visual query builder (drag & drop)
- ❌ ER diagram generation
- ❌ Data migration tools
- ❌ Schema versioning
- ❌ Oracle support (not supported by node-sql-parser)

---

## Success Metrics

### Phase 1 (Complete)

- ✅ 32 unit tests passing
- ✅ Production build under 3MB
- ✅ Real-time transformation < 300ms
- ✅ Zero runtime errors in browser console
- ✅ Works on mobile devices

### Phase 2 (Future)

- [ ] Autocomplete response time < 100ms
- [ ] 95% accuracy for context detection
- [ ] Fuzzy match finds correct suggestion in top 5
- [ ] Works with 100+ table schemas

### Long-term

- [ ] 1000+ active users
- [ ] 90% user satisfaction
- [ ] < 1% crash rate
- [ ] Extension downloads > 10k

---

## Development Workflow

1. **Plan** - Write detailed plan for feature (this document)
2. **Design** - Create interfaces and types
3. **Test** - Write tests first (TDD)
4. **Implement** - Build feature incrementally
5. **Review** - Check against plan and requirements
6. **Document** - Update README and examples
7. **Deploy** - Push to GitHub Pages / marketplace

---

## Contact & Contributing

- **GitHub Issues**: Bug reports and feature requests
- **Pull Requests**: Follow incremental complexity principle
- **Discussions**: Architecture and design decisions

Keep it simple, keep it tested, keep it incremental! 🚀
