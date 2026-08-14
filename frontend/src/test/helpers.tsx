import { expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { installMockFetch, type MockRoute } from './mockApi';
import { defaultRoutes } from './routes';
import { baseUser } from './fixtures';

/**
 * Renders <App/> already logged in (via a GET /auth/me 200 override) so
 * feature tests can skip the login form and go straight to the dashboard.
 * `routes` are matched before the defaults, so pass overrides for whatever
 * the test cares about.
 */
export async function renderLoggedIn(routes: MockRoute[] = [], user = baseUser) {
  const fetchMock = installMockFetch([
    { method: 'GET', test: /\/auth\/me$/, handler: () => ({ status: 200, body: user }) },
    ...routes,
    ...defaultRoutes(),
  ]);
  render(<App />);
  await waitFor(() => expect(screen.getByText('Financial Overview')).toBeInTheDocument());
  return fetchMock;
}

export { screen, waitFor };
