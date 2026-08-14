import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { installMockFetch, jsonBody } from './mockApi';
import { defaultRoutes } from './routes';
import { baseUser } from './fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Auth', () => {
  it('shows the Sign In form by default', async () => {
    installMockFetch(defaultRoutes());
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('registers a new user and lands on the dashboard', async () => {
    const user = userEvent.setup();
    installMockFetch([
      {
        method: 'POST',
        test: /\/auth\/register$/,
        handler: (_url, init) => ({ status: 200, body: { ...baseUser, ...jsonBody(init) } }),
      },
      ...defaultRoutes(),
    ]);
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Register' }));
    await user.type(screen.getByPlaceholderText('e.g. Babajide Alao'), 'New Person');
    await user.type(screen.getByPlaceholderText('e.g. 450000'), '300000');
    await user.type(screen.getByPlaceholderText('e.g. jide@naira.ai'), 'new@naira.ai');
    await user.type(screen.getByPlaceholderText('••••••••'), 'SuperSecret123!');
    await user.click(screen.getByLabelText(/I consent to analyzing my transactions/i));
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => expect(screen.getByText('Financial Overview')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('logs in with valid credentials and shows the dashboard', async () => {
    const user = userEvent.setup();
    installMockFetch([
      { method: 'POST', test: /\/auth\/login$/, handler: () => ({ status: 200, body: baseUser }) },
      ...defaultRoutes(),
    ]);
    render(<App />);

    await user.type(screen.getByPlaceholderText('e.g. jide@naira.ai'), baseUser.email);
    await user.type(screen.getByPlaceholderText('••••••••'), 'whatever');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(screen.getByText(`Welcome back, ${baseUser.full_name}.`, { exact: false })).toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows an error message on invalid credentials', async () => {
    const user = userEvent.setup();
    installMockFetch([
      { method: 'POST', test: /\/auth\/login$/, handler: () => ({ status: 400, body: { detail: 'Incorrect email or password.' } }) },
      ...defaultRoutes(),
    ]);
    render(<App />);

    await user.type(screen.getByPlaceholderText('e.g. jide@naira.ai'), baseUser.email);
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
  });

  it('logs out back to the Sign In screen', async () => {
    const user = userEvent.setup();
    installMockFetch([
      { method: 'POST', test: /\/auth\/login$/, handler: () => ({ status: 200, body: baseUser }) },
      { method: 'POST', test: /\/auth\/logout$/, handler: () => ({ status: 200, body: { message: 'Successfully logged out.' } }) },
      ...defaultRoutes(),
    ]);
    render(<App />);

    await user.type(screen.getByPlaceholderText('e.g. jide@naira.ai'), baseUser.email);
    await user.type(screen.getByPlaceholderText('••••••••'), 'whatever');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    await screen.findByText('Financial Overview', {}, { timeout: 3000 });

    await user.click(screen.getByRole('button', { name: 'Sign Out' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument());
  });

  it('restores an existing session on mount via GET /auth/me', async () => {
    // First match wins, so this override takes precedence over the default 401.
    installMockFetch([
      { method: 'GET', test: /\/auth\/me$/, handler: () => ({ status: 200, body: baseUser }) },
      ...defaultRoutes(),
    ]);
    render(<App />);
    await waitFor(() => expect(screen.getByText('Financial Overview')).toBeInTheDocument());
  });
});
