# Claude Context for reSQL

Quick reference for AI assistants working on this project.

## What is reSQL?

Intelligent SQL editor with real-time refactoring and smart completions (like ReSharper for SQL).

## Essential Files

- **[PLAN.md](../PLAN.md)** - Complete roadmap with all 8 phases, architecture, and specifications
- **[README.md](../README.md)** - User documentation, quick start, examples
- **[src/core/auto-groupby.ts](../src/core/auto-groupby.ts)** - Core transformation logic
- **[tests/auto-groupby.test.ts](../tests/auto-groupby.test.ts)** - 32 tests covering all features

## Current Status

**Phase 1: COMPLETE ✅** Auto GROUP BY with dual-box UI and inline suggestions
**Next: Phase 2** SQLite Autocomplete (see PLAN.md)

## Key Technologies

- TypeScript + node-sql-parser (SQLite dialect)
- sql.js WASM (Chinook database)
- Vite + Vitest
- Separate input/output boxes with Tab-to-accept inline suggestions

## Development Principles

1. Minimal & incremental
2. Test-driven (32/32 passing)
3. AST-based (no regex)
4. Follow PLAN.md roadmap

## Remember

- Read PLAN.md for detailed specifications before implementing features
- Add tests for all changes
- Keep it simple - don't add complexity ahead of the roadmap

