# Claude Context for reSQL Project

This file provides important context for AI assistants working on the reSQL project.

## Project Overview

**reSQL** is an intelligent SQL editor similar to ReSharper for SQL. It provides real-time refactoring, smart completions, and code transformations as users type SQL queries.

## Important Files

### 📋 [PLAN.md](../PLAN.md) - **READ THIS FIRST**
The complete development plan with:
- Vision and goals
- Phased implementation roadmap (8 phases)
- Architecture decisions and design patterns
- Feature specifications for all phases
- Technical implementation details
- Success metrics and requirements

### 📖 [README.md](../README.md)
User-facing documentation with:
- Quick start guide
- Current features (Phase 1 complete)
- Technology stack
- Examples and usage

### 🧪 [tests/auto-groupby.test.ts](../tests/auto-groupby.test.ts)
32 comprehensive tests covering:
- Auto GROUP BY generation logic
- Quote removal functionality
- GROUP BY removal logic
- SQLite dialect compatibility
- Integration tests

### 🔧 [src/core/auto-groupby.ts](../src/core/auto-groupby.ts)
Core transformation logic:
- AST-based SQL parsing
- Aggregate function detection
- GROUP BY generation/removal
- Quote removal for clean output

## Current Status

**Phase 1: COMPLETE ✅**
- Auto GROUP BY feature fully implemented
- Web UI deployed to GitHub Pages
- All tests passing (32/32)
- 5 bug fixes completed

**Next: Phase 2 (SQLite Autocomplete)**
- See PLAN.md for detailed feature specifications

## Development Principles

1. **Minimal & Incremental** - Start simple, add complexity gradually
2. **Test-Driven** - Write tests first, comprehensive coverage
3. **AST-based** - No regex hacks, proper SQL parsing
4. **Cross-platform** - TypeScript core works everywhere (CLI, Web, VS Code)

## Key Decisions Made

- **Language:** TypeScript (runs everywhere)
- **Parser:** node-sql-parser with SQLite dialect
- **Demo DB:** Chinook (music store) via sql.js WASM
- **Testing:** Vitest (32 tests, all passing)
- **Build:** Vite for fast dev and production builds
- **Deployment:** GitHub Pages with GitHub Actions

## Bug Fixes History

1. ✅ MySQL dialect to avoid double quotes (then reverted)
2. ✅ Remove GROUP BY when only aggregates present
3. ✅ Correct Chinook table names (Track vs tracks)
4. ✅ Remove unnecessary quotes from identifiers
5. ✅ SQLite dialect + GROUP BY removal without aggregates

## Architecture

```
Core Engine (src/core/)
    ↓
Web UI (src/web/)
    ↓
Future: LSP → CLI & VS Code Extension
```

## Working with This Project

1. **Before starting new work:** Read PLAN.md to understand the roadmap
2. **Making changes:** Update tests first (TDD approach)
3. **Bug fixes:** Add regression tests, one commit per fix
4. **New features:** Check PLAN.md for specifications
5. **Documentation:** Keep README.md and PLAN.md in sync

## Testing

```bash
npm test              # Run all tests
npm run dev          # Development server
npm run build        # Production build
```

All tests must pass before committing.

## Deployment

- **GitHub Pages:** https://divieira.github.io/resql/
- **Auto-deploy:** GitHub Actions on push to main branch
- **Branch:** claude/resql-architecture-design-0T2EQ

## Questions?

1. Check PLAN.md first - it has detailed specifications
2. Read existing tests to understand behavior
3. Review commit history for context on bug fixes
4. Consult README.md for user-facing features

---

**Remember:** This is an incremental project. Don't add complexity that isn't needed yet. Follow the phased plan in PLAN.md.
