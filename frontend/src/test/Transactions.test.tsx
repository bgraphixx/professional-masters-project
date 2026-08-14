import { describe, it, expect, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, renderLoggedIn } from './helpers';
import { jsonBody } from './mockApi';
import { makeTransaction } from './fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function gotoTransactionsTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Transactions' }));
  await screen.findByText('Transaction Management');
}

describe('Transactions tab', () => {
  it('renders the transaction list', async () => {
    const user = userEvent.setup();
    await renderLoggedIn([
      {
        method: 'GET',
        test: /\/transactions(\?|$)/,
        handler: () => ({ status: 200, body: [makeTransaction({ description: 'Uber ride to VI' })] }),
      },
    ]);
    await gotoTransactionsTab(user);
    expect(await screen.findByText('Uber ride to VI')).toBeInTheDocument();
  });

  it('shows an empty state with no transactions', async () => {
    const user = userEvent.setup();
    await renderLoggedIn();
    await gotoTransactionsTab(user);
    expect(await screen.findByText('No transactions found.')).toBeInTheDocument();
  });

  it('adds a manual transaction and refreshes the list', async () => {
    const user = userEvent.setup();
    let created = false;
    await renderLoggedIn([
      {
        method: 'POST',
        test: /\/transactions$/,
        handler: (_url, init) => {
          created = true;
          return { status: 200, body: makeTransaction(jsonBody(init)) };
        },
      },
      {
        method: 'GET',
        test: /\/transactions(\?|$)/,
        handler: () => ({ status: 200, body: created ? [makeTransaction({ description: 'Bus fare to Ikeja' })] : [] }),
      },
    ]);
    await gotoTransactionsTab(user);

    await user.click(screen.getByRole('button', { name: 'Add Manual' }));
    await user.type(screen.getByPlaceholderText('e.g. Bus fare to Ikeja'), 'Bus fare to Ikeja');
    await user.type(screen.getByPlaceholderText('2500'), '1200');
    await user.click(screen.getByRole('button', { name: 'Create Transaction' }));

    await waitFor(() => expect(screen.getByText('Bus fare to Ikeja')).toBeInTheDocument());
  });

  it('deletes a transaction after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    let deleted = false;
    await renderLoggedIn([
      {
        method: 'DELETE',
        test: /\/transactions\/tx-delete-me$/,
        handler: () => { deleted = true; return { status: 200, body: { message: 'Transaction deleted successfully.' } }; },
      },
      {
        method: 'GET',
        test: /\/transactions(\?|$)/,
        handler: () => ({ status: 200, body: deleted ? [] : [makeTransaction({ id: 'tx-delete-me', description: 'Delete me' })] }),
      },
    ]);
    await gotoTransactionsTab(user);
    await screen.findByText('Delete me');

    const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-trash-2'));
    await user.click(deleteButtons[0]);

    await waitFor(() => expect(screen.queryByText('Delete me')).not.toBeInTheDocument());
  });

  it('does not delete when confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    await renderLoggedIn([
      {
        method: 'GET',
        test: /\/transactions(\?|$)/,
        handler: () => ({ status: 200, body: [makeTransaction({ id: 'tx-keep-me', description: 'Keep me' })] }),
      },
    ]);
    await gotoTransactionsTab(user);
    await screen.findByText('Keep me');

    const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-trash-2'));
    await user.click(deleteButtons[0]);

    expect(screen.getByText('Keep me')).toBeInTheDocument();
  });

  it('refetches with a type filter applied', async () => {
    const user = userEvent.setup();
    const fetchMock = await renderLoggedIn([
      { method: 'GET', test: /\/transactions(\?|$)/, handler: () => ({ status: 200, body: [] }) },
    ]);
    await gotoTransactionsTab(user);

    fetchMock.mockClear();
    await user.selectOptions(screen.getByDisplayValue('All Types'), 'income');

    await waitFor(() => {
      const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u.includes('/transactions?type=income'))).toBe(true);
    });
  });

  it('paginates when there are more than 20 transactions', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 25 }, (_, i) => makeTransaction({ id: `tx-${i}`, description: `Transaction #${i}` }));
    await renderLoggedIn([
      { method: 'GET', test: /\/transactions(\?|$)/, handler: () => ({ status: 200, body: many }) },
    ]);
    await gotoTransactionsTab(user);

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Transaction #0')).toBeInTheDocument();
    expect(screen.queryByText('Transaction #20')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Transaction #20')).toBeInTheDocument();
  });
});
