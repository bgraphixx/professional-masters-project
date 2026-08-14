import { describe, it, expect, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, renderLoggedIn } from './helpers';
import { jsonBody } from './mockApi';
import { adminUser, adminMlMetrics, makeAdminUserRow, categories } from './fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Admin tab gating', () => {
  it('hides the Admin nav item for a non-admin user', async () => {
    await renderLoggedIn();
    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('shows the Admin nav item for an admin user', async () => {
    await renderLoggedIn([], adminUser);
    expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument();
  });
});

describe('Admin tab', () => {
  async function gotoAdminTab(user: ReturnType<typeof userEvent.setup>, routes: Parameters<typeof renderLoggedIn>[0] = []) {
    await renderLoggedIn(routes, adminUser);
    await user.click(screen.getByRole('button', { name: 'Admin' }));
    await screen.findByText('User Oversight');
  }

  it('renders the users table with server-driven pagination', async () => {
    const user = userEvent.setup();
    const rows = [makeAdminUserRow({ email: 'a@nairaai-test.com', transaction_count: 3 })];
    await gotoAdminTab(user, [
      {
        method: 'GET',
        test: /\/admin\/users\?skip=0&limit=10$/,
        handler: () => ({ status: 200, body: { total: 15, skip: 0, limit: 10, users: rows } }),
      },
    ]);

    expect(await screen.findByText('a@nairaai-test.com')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('advances to the next page of users', async () => {
    const user = userEvent.setup();
    await gotoAdminTab(user, [
      {
        method: 'GET',
        test: /\/admin\/users\?skip=0&limit=10$/,
        handler: () => ({ status: 200, body: { total: 15, skip: 0, limit: 10, users: [makeAdminUserRow({ email: 'page1@nairaai-test.com' })] } }),
      },
      {
        method: 'GET',
        test: /\/admin\/users\?skip=10&limit=10$/,
        handler: () => ({ status: 200, body: { total: 15, skip: 10, limit: 10, users: [makeAdminUserRow({ email: 'page2@nairaai-test.com' })] } }),
      },
    ]);
    await screen.findByText('page1@nairaai-test.com');

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('page2@nairaai-test.com')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('renders the category taxonomy list', async () => {
    const user = userEvent.setup();
    await gotoAdminTab(user, [
      { method: 'GET', test: /\/admin\/categories$/, handler: () => ({ status: 200, body: categories }) },
    ]);
    expect(await screen.findByText('Food & Groceries')).toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();
  });

  it('creates a new category from the form', async () => {
    const user = userEvent.setup();
    let created = false;
    await gotoAdminTab(user, [
      {
        method: 'POST',
        test: /\/admin\/categories$/,
        handler: (_url, init) => {
          created = true;
          const body = jsonBody(init);
          return { status: 201, body: { id: 'new-cat', name: body.name, type: body.type, is_default: false } };
        },
      },
      {
        method: 'GET',
        test: /\/admin\/categories$/,
        handler: () => ({ status: 200, body: created ? [...categories, { id: 'new-cat', name: 'Pet Care', type: 'expense', is_default: false }] : categories }),
      },
    ]);
    await screen.findByText('Category Taxonomy');

    await user.type(screen.getByPlaceholderText('New category name'), 'Pet Care');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(screen.getByText('Pet Care')).toBeInTheDocument());
  });

  it('renders ML model health metrics', async () => {
    const user = userEvent.setup();
    await gotoAdminTab(user, [
      { method: 'GET', test: /\/admin\/ml\/metrics$/, handler: () => ({ status: 200, body: adminMlMetrics }) },
    ]);
    expect(await screen.findByText('99.0%')).toBeInTheDocument();
    expect(screen.getByText('61.9%')).toBeInTheDocument();
    expect(screen.getByText('59.1%')).toBeInTheDocument();
  });

  it('shows a fallback state when ML metrics are unavailable', async () => {
    const user = userEvent.setup();
    await gotoAdminTab(user, [
      { method: 'GET', test: /\/admin\/ml\/metrics$/, handler: () => ({ status: 200, body: {} }) },
    ]);
    await screen.findByText('ML Model Health');
    expect(await screen.findAllByText('—')).not.toHaveLength(0);
  });
});
