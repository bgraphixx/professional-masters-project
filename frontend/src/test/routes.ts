import type { MockRoute } from './mockApi';
import { categories } from './fixtures';

/**
 * Sensible defaults for the endpoints App.tsx hits on every dashboard load
 * (categories, transactions, budgets, insights all empty). Tests prepend
 * more specific routes before these so `routes.find` picks the override.
 */
export function defaultRoutes(): MockRoute[] {
  return [
    { method: 'GET', test: /\/auth\/me$/, handler: () => ({ status: 401, body: { detail: 'Not authenticated' } }) },
    { method: 'GET', test: /\/transactions\/categories$/, handler: () => ({ status: 200, body: categories }) },
    { method: 'GET', test: /\/transactions(\?|$)/, handler: () => ({ status: 200, body: [] }) },
    { method: 'GET', test: /\/budgets(\?|$)/, handler: () => ({ status: 200, body: [] }) },
    { method: 'GET', test: /\/insights$/, handler: () => ({ status: 200, body: [] }) },
  ];
}
