import { describe, it, expect, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, renderLoggedIn } from './helpers';
import { jsonBody } from './mockApi';
import { makeBudget } from './fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function gotoBudgetsTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Budgets' }));
  await screen.findByRole('button', { name: /Add Budget/ });
}

describe('Budgets tab', () => {
  it('shows the empty state with no budgets', async () => {
    const user = userEvent.setup();
    await renderLoggedIn();
    await gotoBudgetsTab(user);
    expect(await screen.findByText(/No budgets for/)).toBeInTheDocument();
  });

  it('renders a budget card with spend progress', async () => {
    const user = userEvent.setup();
    await renderLoggedIn([
      {
        method: 'GET',
        test: /\/budgets(\?|$)/,
        handler: () => ({ status: 200, body: [makeBudget({ spent_amount: 20000, limit_amount: 50000, percent_used: 40 })] }),
      },
    ]);
    await gotoBudgetsTab(user);

    expect(await screen.findByText('Food & Groceries')).toBeInTheDocument();
    expect(screen.getByText('40% used')).toBeInTheDocument();
  });

  it('flags a breached budget', async () => {
    const user = userEvent.setup();
    await renderLoggedIn([
      {
        method: 'GET',
        test: /\/budgets(\?|$)/,
        handler: () => ({ status: 200, body: [makeBudget({ spent_amount: 60000, limit_amount: 50000, percent_used: 120, is_breached: true })] }),
      },
    ]);
    await gotoBudgetsTab(user);
    expect(await screen.findByText('BREACHED')).toBeInTheDocument();
  });

  it('creates a new budget', async () => {
    const user = userEvent.setup();
    let created = false;
    await renderLoggedIn([
      {
        method: 'POST',
        test: /\/budgets$/,
        handler: (_url, init) => {
          created = true;
          return { status: 201, body: makeBudget(jsonBody(init)) };
        },
      },
      {
        method: 'GET',
        test: /\/budgets(\?|$)/,
        handler: () => ({ status: 200, body: created ? [makeBudget({ limit_amount: 75000 })] : [] }),
      },
    ]);
    await gotoBudgetsTab(user);

    await user.click(screen.getByRole('button', { name: /Add Budget/ }));
    await user.selectOptions(screen.getByText('Select a category...').closest('select')!, 'cat-food');
    await user.type(screen.getByPlaceholderText('e.g. 50000'), '75000');
    await user.click(screen.getByRole('button', { name: 'Create Budget' }));

    await waitFor(() => expect(screen.getAllByText(/75,000/).length).toBeGreaterThan(0));
  });

  it('surfaces a 409 duplicate-budget error without crashing', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await renderLoggedIn([
      {
        method: 'POST',
        test: /\/budgets$/,
        handler: () => ({ status: 409, body: { detail: 'A budget for this category and month already exists.' } }),
      },
      { method: 'GET', test: /\/budgets(\?|$)/, handler: () => ({ status: 200, body: [] }) },
    ]);
    await gotoBudgetsTab(user);

    await user.click(screen.getByRole('button', { name: /Add Budget/ }));
    await user.selectOptions(screen.getByText('Select a category...').closest('select')!, 'cat-food');
    await user.type(screen.getByPlaceholderText('e.g. 50000'), '10000');
    await user.click(screen.getByRole('button', { name: 'Create Budget' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('A budget for this category and month already exists.'));
  });

  it('deletes a budget', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    let deleted = false;
    await renderLoggedIn([
      {
        method: 'DELETE',
        test: /\/budgets\/budget-delete-me$/,
        handler: () => { deleted = true; return { status: 200, body: { message: 'Budget deleted successfully.' } }; },
      },
      {
        method: 'GET',
        test: /\/budgets(\?|$)/,
        handler: () => ({ status: 200, body: deleted ? [] : [makeBudget({ id: 'budget-delete-me' })] }),
      },
    ]);
    await gotoBudgetsTab(user);
    await screen.findByText('Food & Groceries');

    const deleteButton = screen.getByTitle('Delete');
    await user.click(deleteButton);

    await waitFor(() => expect(screen.getByText(/No budgets for/)).toBeInTheDocument());
  });
});
