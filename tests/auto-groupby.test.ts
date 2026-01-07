import { describe, it, expect } from 'vitest';
import { addAutoGroupBy, isValidSQL } from '../src/core/auto-groupby';

describe('Auto GROUP BY', () => {
  describe('Basic aggregate detection', () => {
    it('should add GROUP BY for COUNT with non-aggregate column', () => {
      const input = 'SELECT name, COUNT(*) FROM users';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('name');
    });

    it('should add GROUP BY for SUM with non-aggregate column', () => {
      const input = 'SELECT category, SUM(price) FROM products';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('category');
    });

    it('should add GROUP BY for AVG with non-aggregate column', () => {
      const input = 'SELECT department, AVG(salary) FROM employees';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('department');
    });

    it('should add GROUP BY for MIN with non-aggregate column', () => {
      const input = 'SELECT type, MIN(price) FROM items';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('type');
    });

    it('should add GROUP BY for MAX with non-aggregate column', () => {
      const input = 'SELECT category, MAX(views) FROM posts';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('category');
    });
  });

  describe('Multiple columns', () => {
    it('should handle multiple non-aggregate columns', () => {
      const input = 'SELECT city, country, COUNT(*) FROM users';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('city');
      expect(result.toLowerCase()).toContain('country');
    });

    it('should handle multiple aggregate functions', () => {
      const input = 'SELECT category, SUM(price), AVG(price), COUNT(*) FROM products';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('category');
    });
  });

  describe('No transformation needed', () => {
    it('should not modify query with only aggregates', () => {
      const input = 'SELECT COUNT(*), SUM(price) FROM products';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).not.toContain('group by');
    });

    it('should not modify query without aggregates', () => {
      const input = 'SELECT name, email FROM users';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).not.toContain('group by');
    });

    it('should not modify query that already has GROUP BY', () => {
      const input = 'SELECT name, COUNT(*) FROM users GROUP BY name';
      const result = addAutoGroupBy(input);
      // Should still have GROUP BY but not duplicate it
      const groupByCount = (result.toLowerCase().match(/group by/g) || []).length;
      expect(groupByCount).toBe(1);
    });

    it('should not add GROUP BY to SELECT *', () => {
      const input = 'SELECT * FROM users';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).not.toContain('group by');
    });
  });

  describe('Complex queries', () => {
    it('should handle queries with WHERE clause', () => {
      const input = 'SELECT category, COUNT(*) FROM products WHERE price > 100';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('category');
      expect(result.toLowerCase()).toContain('where');
    });

    it('should handle queries with table aliases', () => {
      const input = 'SELECT u.name, COUNT(*) FROM users u';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
    });

    it('should handle nested function calls', () => {
      const input = 'SELECT category, COUNT(DISTINCT user_id) FROM orders';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('category');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const input = '';
      const result = addAutoGroupBy(input);
      expect(result).toBe('');
    });

    it('should not crash on edge case SQL', () => {
      const input = 'SELECT this is not valid SQL';
      const result = addAutoGroupBy(input);
      // Should not crash, returns some result
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle queries with column aliases', () => {
      const input = 'SELECT name AS user_name, COUNT(*) AS total FROM users';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
    });
  });

  describe('SQL validation', () => {
    it('should validate correct SQL', () => {
      expect(isValidSQL('SELECT * FROM users')).toBe(true);
      expect(isValidSQL('SELECT name, COUNT(*) FROM users GROUP BY name')).toBe(true);
    });

    it('should reject clearly invalid SQL', () => {
      expect(isValidSQL('not sql at all')).toBe(false);
      expect(isValidSQL('')).toBe(false);
      expect(isValidSQL('completely invalid nonsense')).toBe(false);
    });
  });

  describe('Quote removal (Bug fix #1 & #4)', () => {
    it('should remove unnecessary quotes from simple identifiers', () => {
      const input = 'SELECT Name, COUNT(*) FROM Track';
      const result = addAutoGroupBy(input);
      // Should not have quotes around simple identifiers
      expect(result).not.toMatch(/["'`]Name["'`]/);
      expect(result).not.toMatch(/["'`]Track["'`]/);
    });

    it('should allow typing partial queries without adding quotes', () => {
      const input = 'SELECT Name, c FROM Track';
      const result = addAutoGroupBy(input);
      // Should not add quotes around partial identifier 'c'
      expect(result).not.toMatch(/["'`]c["'`]/);
      expect(result).toContain('c');
    });

    it('should keep quotes for reserved keywords used as identifiers', () => {
      const input = 'SELECT "select", COUNT(*) FROM Track';
      const result = addAutoGroupBy(input);
      // Should keep quotes for reserved keyword
      expect(result).toMatch(/["'`]select["'`]/);
    });

    it('should handle multiple columns without unnecessary quotes', () => {
      const input = 'SELECT AlbumId, Composer, COUNT(*) FROM Track';
      const result = addAutoGroupBy(input);
      // Clean output without excessive quoting
      expect(result).toContain('AlbumId');
      expect(result).toContain('Composer');
      expect(result).toContain('Track');
    });
  });

  describe('GROUP BY removal logic (Bug fix #2 & #5)', () => {
    it('should remove GROUP BY when there are no aggregates', () => {
      const input = 'SELECT name FROM users GROUP BY name';
      const result = addAutoGroupBy(input);
      // GROUP BY should be removed since there are no aggregates
      expect(result.toLowerCase()).not.toContain('group by');
      expect(result).toContain('name');
    });

    it('should remove GROUP BY from query with only aggregate columns', () => {
      const input = 'SELECT COUNT(*), SUM(price) FROM products GROUP BY category';
      const result = addAutoGroupBy(input);
      // GROUP BY should be removed since all columns are aggregates
      expect(result.toLowerCase()).not.toContain('group by');
    });

    it('should keep GROUP BY when there are both aggregates and non-aggregates', () => {
      const input = 'SELECT category, COUNT(*) FROM products';
      const result = addAutoGroupBy(input);
      // Should add GROUP BY
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('category');
    });

    it('should remove unnecessary GROUP BY from multi-column query without aggregates', () => {
      const input = 'SELECT name, email FROM users GROUP BY name, email';
      const result = addAutoGroupBy(input);
      // No aggregates, so GROUP BY should be removed
      expect(result.toLowerCase()).not.toContain('group by');
    });

    it('should handle complex query with WHERE and remove GROUP BY if no aggregates', () => {
      const input = 'SELECT name FROM users WHERE active = 1 GROUP BY name';
      const result = addAutoGroupBy(input);
      // No aggregates, GROUP BY should be removed
      expect(result.toLowerCase()).not.toContain('group by');
      expect(result.toLowerCase()).toContain('where');
    });
  });

  describe('SQLite dialect compatibility (Bug fix #3)', () => {
    it('should work with Chinook database table names', () => {
      const input = 'SELECT Name, COUNT(*) FROM Track';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result).toContain('Name');
      expect(result).toContain('Track');
    });

    it('should handle PascalCase table names correctly', () => {
      const input = 'SELECT AlbumId, COUNT(*) FROM Track';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result).toContain('AlbumId');
    });
  });

  describe('Comprehensive integration tests', () => {
    it('should handle typing workflow: partial query to complete query', () => {
      // Simulate user typing
      const partial1 = 'SELECT N FROM Track';
      const partial2 = 'SELECT Name FROM Track';
      const partial3 = 'SELECT Name, c FROM Track';
      const partial4 = 'SELECT Name, COUNT FROM Track';
      const complete = 'SELECT Name, COUNT(*) FROM Track';

      // All should work without errors
      expect(() => addAutoGroupBy(partial1)).not.toThrow();
      expect(() => addAutoGroupBy(partial2)).not.toThrow();
      expect(() => addAutoGroupBy(partial3)).not.toThrow();
      expect(() => addAutoGroupBy(partial4)).not.toThrow();

      const result = addAutoGroupBy(complete);
      expect(result.toLowerCase()).toContain('group by');
      expect(result).toContain('Name');
    });

    it('should maintain clean SQL output through transformations', () => {
      const input = 'SELECT Artist, Album, COUNT(*) FROM Track';
      const result = addAutoGroupBy(input);

      // Should have GROUP BY
      expect(result.toLowerCase()).toContain('group by');

      // Should have both columns in GROUP BY
      expect(result.toLowerCase()).toContain('artist');
      expect(result.toLowerCase()).toContain('album');

      // Should not have excessive quotes
      const quoteCount = (result.match(/["'`]/g) || []).length;
      expect(quoteCount).toBeLessThan(6); // Allow some quotes but not excessive
    });
  });
});
