import pkg from 'node-sql-parser';
const { Parser } = pkg;

const parser = new Parser();

// Aggregate functions to detect
const AGGREGATE_FUNCTIONS = new Set([
  'SUM', 'COUNT', 'MIN', 'MAX', 'AVG',
  'STDDEV', 'VARIANCE', 'GROUP_CONCAT',
  'STRING_AGG', 'ARRAY_AGG'
]);

/**
 * Walk the AST to detect if an expression contains an aggregate function
 */
function hasAggregateFunction(node: any): boolean {
  if (!node || typeof node !== 'object') {
    return false;
  }

  // Check if this node is a function call
  if (node.type === 'aggr_func') {
    return true;
  }

  // Check if this is a function with a name that's an aggregate
  if (node.type === 'function') {
    const funcName = node.name?.toUpperCase();
    if (funcName && AGGREGATE_FUNCTIONS.has(funcName)) {
      return true;
    }
  }

  // Recursively check all properties
  for (const key in node) {
    const value = node[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        if (hasAggregateFunction(item)) {
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      if (hasAggregateFunction(value)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract column expressions that should be in GROUP BY
 */
function extractGroupByColumns(columns: any[]): any[] {
  const groupByExprs: any[] = [];

  for (const col of columns) {
    // Skip * columns
    if (col.expr.type === 'column_ref' && col.expr.column === '*') {
      continue;
    }

    // If column doesn't have an aggregate, add to GROUP BY
    if (!hasAggregateFunction(col.expr)) {
      groupByExprs.push(col.expr);
    }
  }

  return groupByExprs;
}

/**
 * Add auto GROUP BY to a SQL query
 */
export function addAutoGroupBy(sql: string): string {
  try {
    // Parse the SQL - using MySQL dialect for cleaner output (backticks instead of double quotes)
    const ast = parser.astify(sql, { database: 'mysql' });

    // Handle both single statement and array of statements
    const statements = Array.isArray(ast) ? ast : [ast];

    for (const stmt of statements) {
      // Only process SELECT statements
      if (stmt.type !== 'select') {
        continue;
      }

      // Skip if already has GROUP BY
      if (stmt.groupby) {
        continue;
      }

      const columns = stmt.columns;
      if (!columns || columns.length === 0) {
        continue;
      }

      // Find columns with aggregates
      const hasAggregates = columns.some((col: any) => hasAggregateFunction(col.expr));

      if (hasAggregates) {
        // Extract non-aggregate columns for GROUP BY
        const groupByExprs = extractGroupByColumns(columns);

        // Only add GROUP BY if we have non-aggregate columns
        if (groupByExprs.length > 0) {
          stmt.groupby = {
            columns: groupByExprs,
            modifiers: []
          };
        }
      }
    }

    // Convert AST back to SQL - MySQL dialect uses backticks which look cleaner
    const result = parser.sqlify(statements.length === 1 ? statements[0] : statements, { database: 'mysql' });
    return result;
  } catch (error) {
    // If parsing fails, return original SQL
    console.error('Parse error:', error);
    return sql;
  }
}

/**
 * Check if a SQL string is valid
 */
export function isValidSQL(sql: string): boolean {
  if (!sql || sql.trim() === '') {
    return false;
  }

  try {
    const ast = parser.astify(sql, { database: 'mysql' });
    return ast !== null && ast !== undefined;
  } catch {
    return false;
  }
}
