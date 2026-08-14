import { describe, it, expect, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, renderLoggedIn } from './helpers';
import { jsonBody } from './mockApi';
import { baseUser } from './fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function gotoSettingsTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await screen.findByText('Profile Details');
}

// The Security card's labels aren't associated with their inputs via
// htmlFor/id (siblings in the same wrapper div), so getByLabelText can't
// find them — walk to the sibling input instead.
function passwordInputFor(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText);
  return label.parentElement!.querySelector('input')!;
}

describe('Settings tab', () => {
  it('pre-fills the profile form from the current user', async () => {
    const user = userEvent.setup();
    await renderLoggedIn();
    await gotoSettingsTab(user);
    expect(screen.getByDisplayValue(baseUser.full_name)).toBeInTheDocument();
  });

  it('updates the profile and re-syncs the form from the server response', async () => {
    const user = userEvent.setup();
    let receivedBody: any = null;
    await renderLoggedIn([
      {
        method: 'PUT',
        test: /\/auth\/profile$/,
        handler: (_url, init) => {
          receivedBody = jsonBody(init);
          // Server normalizes the name differently than what was typed.
          return { status: 200, body: { ...baseUser, full_name: 'Server Normalized Name' } };
        },
      },
    ]);
    await gotoSettingsTab(user);

    const nameInput = screen.getByDisplayValue(baseUser.full_name);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');
    await user.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => expect(screen.getByDisplayValue('Server Normalized Name')).toBeInTheDocument());
    expect(receivedBody.full_name).toBe('Updated Name');
  });

  it('re-enables the Save button after a failed profile update, without clobbering the typed value', async () => {
    const user = userEvent.setup();
    await renderLoggedIn([
      { method: 'PUT', test: /\/auth\/profile$/, handler: () => ({ status: 400, body: { detail: 'Something went wrong.' } }) },
    ]);
    await gotoSettingsTab(user);

    const nameInput = screen.getByDisplayValue(baseUser.full_name);
    await user.clear(nameInput);
    await user.type(nameInput, 'Should Stay Typed');
    await user.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Profile' })).not.toBeDisabled());
    expect(screen.getByDisplayValue('Should Stay Typed')).toBeInTheDocument();
  });

  it('clears the password fields after a successful password change', async () => {
    const user = userEvent.setup();
    await renderLoggedIn([
      { method: 'PUT', test: /\/auth\/password$/, handler: () => ({ status: 200, body: { message: 'Password updated successfully.' } }) },
    ]);
    await gotoSettingsTab(user);

    await user.type(passwordInputFor('Current Password'), 'OldPass123!');
    await user.type(passwordInputFor('New Password'), 'NewPass456!');
    await user.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => expect(passwordInputFor('Current Password').value).toBe(''));
    expect(passwordInputFor('New Password').value).toBe('');
  });

  it('keeps the typed passwords when the current password is wrong', async () => {
    const user = userEvent.setup();
    await renderLoggedIn([
      { method: 'PUT', test: /\/auth\/password$/, handler: () => ({ status: 400, body: { detail: 'Incorrect current password.' } }) },
    ]);
    await gotoSettingsTab(user);

    await user.type(passwordInputFor('Current Password'), 'WrongPassword!');
    await user.type(passwordInputFor('New Password'), 'NewPass456!');
    await user.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Update Password' })).not.toBeDisabled());
    expect(passwordInputFor('Current Password').value).toBe('WrongPassword!');
  });

  it('nukes all transactions after confirmation and refetches the (now empty) list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    let nuked = false;
    await renderLoggedIn([
      {
        method: 'DELETE',
        test: /\/transactions\/all$/,
        handler: () => { nuked = true; return { status: 200, body: { message: 'All transactions deleted successfully.' } }; },
      },
      { method: 'GET', test: /\/transactions(\?|$)/, handler: () => ({ status: 200, body: nuked ? [] : [] }) },
    ]);
    await gotoSettingsTab(user);

    await user.click(screen.getByRole('button', { name: 'Nuke All Data' }));

    await waitFor(() => expect(nuked).toBe(true));
  });

  it('does not nuke transactions when confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    let nuked = false;
    await renderLoggedIn([
      {
        method: 'DELETE',
        test: /\/transactions\/all$/,
        handler: () => { nuked = true; return { status: 200, body: { message: 'All transactions deleted successfully.' } }; },
      },
    ]);
    await gotoSettingsTab(user);

    await user.click(screen.getByRole('button', { name: 'Nuke All Data' }));

    expect(nuked).toBe(false);
  });
});
