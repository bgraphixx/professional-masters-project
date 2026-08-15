import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiGet, apiPut, apiDelete, apiPost, apiErrorDetail } from '../api';
import { useAsyncEffect } from '../hooks';
import Banner from './Banner';
import type { MlStats, MlTrainResponse, MessageResponse, Transaction, UserProfile } from '../types';

function errorMessageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

interface SettingsTabProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  pendingRetrain: boolean;
  setPendingRetrain: (v: boolean) => void;
}

export default function SettingsTab({ user, onUserUpdated, pendingRetrain, setPendingRetrain }: SettingsTabProps) {
  const [profileFullName, setProfileFullName] = useState(user.full_name);
  const [profileIncome, setProfileIncome] = useState(String(user.monthly_income));
  const [profileProfession, setProfileProfession] = useState(user.profession || '');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [mlStats, setMlStats] = useState<MlStats | null>(null);
  const [mlTraining, setMlTraining] = useState(false);

  // Re-sync the form fields whenever a fresh `user` comes in (e.g. after a
  // successful save). Adjusting state during render — rather than in a
  // useEffect — is the React-recommended pattern for "reset state when a
  // prop changes" and avoids react-hooks/set-state-in-effect.
  const [syncedUser, setSyncedUser] = useState(user);
  if (syncedUser !== user) {
    setSyncedUser(user);
    setProfileFullName(user.full_name);
    setProfileIncome(String(user.monthly_income));
    setProfileProfession(user.profession || '');
  }

  useAsyncEffect(async () => {
    const { ok, data } = await apiGet<Transaction[]>('/transactions');
    if (ok) setTransactions(data);
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { ok, data } = await apiPut<UserProfile>('/auth/profile', {
        full_name: profileFullName,
        monthly_income: parseFloat(profileIncome) || 0,
        profession: profileProfession,
      });
      if (!ok) throw new Error(apiErrorDetail(data, 'Failed to update profile'));
      onUserUpdated(data);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(errorMessageOf(err, 'Failed to update profile'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { ok, data } = await apiPut<MessageResponse>('/auth/password', {
        current_password: profileCurrentPassword,
        new_password: profileNewPassword,
      });
      if (!ok) throw new Error(apiErrorDetail(data, 'Failed to update password'));
      setSuccessMessage('Password updated successfully!');
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(errorMessageOf(err, 'Failed to update password'));
    } finally {
      setLoading(false);
    }
  };

  const handleNukeTransactions = async () => {
    if (!confirm('Are you absolutely sure you want to nuke all your transactions? This cannot be undone!')) return;
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { ok, data } = await apiDelete<MessageResponse>('/transactions/all');
      if (!ok) throw new Error(apiErrorDetail(data, 'Failed to delete transactions'));
      setSuccessMessage('All transactions have been deleted.');
      setTimeout(() => setSuccessMessage(''), 3000);
      const refetch = await apiGet<Transaction[]>('/transactions');
      if (refetch.ok) setTransactions(refetch.data);
    } catch (err) {
      setErrorMessage(errorMessageOf(err, 'Failed to delete transactions'));
    } finally {
      setLoading(false);
    }
  };

  const handleRetrainModel = async () => {
    setMlTraining(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { ok, data } = await apiPost<MlTrainResponse>('/ml/train');
      if (!ok) throw new Error(apiErrorDetail(data, 'Failed to retrain model'));
      setMlStats({
        default_samples: data.default_samples,
        user_samples: data.user_samples,
        total_samples: data.total_samples,
        last_trained: new Date().toLocaleTimeString(),
      });
      setPendingRetrain(false);
      setSuccessMessage('AI classification model retrained successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      const refetch = await apiGet<Transaction[]>('/transactions');
      if (refetch.ok) setTransactions(refetch.data);
    } catch (err) {
      setErrorMessage(errorMessageOf(err, 'An error occurred during model retraining.'));
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setMlTraining(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-on-background">Settings</h2>
        <p className="text-slate-500 text-sm mt-1">Manage your account and preferences.</p>
      </div>

      <Banner error={errorMessage} success={successMessage} />

      {/* Profile Form */}
      <div className="bg-surface-lowest rounded-xl border border-outline-variant p-6 shadow-sm">
        <h3 className="text-lg font-bold text-on-background mb-4">Profile Details</h3>
        <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Full Name</label>
            <input type="text" required value={profileFullName} onChange={(e) => setProfileFullName(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Monthly Income (₦)</label>
            <input type="number" required min="0" value={profileIncome} onChange={(e) => setProfileIncome(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Profession / Occupation</label>
            <input type="text" placeholder="e.g. Software Engineer" value={profileProfession} onChange={(e) => setProfileProfession(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all" />
          </div>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-primary hover:bg-[#00522b] text-white rounded-default font-bold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Password Form */}
      <div className="bg-surface-lowest rounded-xl border border-outline-variant p-6 shadow-sm">
        <h3 className="text-lg font-bold text-on-background mb-4">Security</h3>
        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-lg">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Current Password</label>
            <input type="password" required value={profileCurrentPassword} onChange={(e) => setProfileCurrentPassword(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">New Password</label>
            <input type="password" required minLength={8} value={profileNewPassword} onChange={(e) => setProfileNewPassword(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all" />
          </div>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-default font-bold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50">
            {loading ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>

      <div className="bg-surface-lowest rounded-xl border border-outline-variant p-6 shadow-sm">
        <h3 className="text-lg font-bold text-error mb-4">Danger Zone</h3>
        <div className="border border-error/20 bg-error/5 rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-error">Nuke All Transactions</h4>
            <p className="text-sm text-slate-600 mt-1 max-w-md">Permanently delete all your imported and manually created transactions. This action cannot be undone.</p>
          </div>
          <button
            onClick={handleNukeTransactions}
            disabled={loading}
            className="px-5 py-2.5 bg-error hover:bg-[#b91c1c] text-white rounded-default font-bold text-sm shadow-sm transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Nuking...' : 'Nuke All Data'}
          </button>
        </div>
      </div>

      {/* ML Retraining Console */}
      <div className="bg-surface-lowest rounded-xl border border-outline-variant p-6 shadow-sm">
        <h3 className="text-lg font-bold text-on-background mb-4">ML Retraining</h3>
        <div className="space-y-1 font-mono text-[10px] text-slate-500 bg-surface-low border border-outline-variant/40 rounded p-3">
          <div className="flex justify-between"><span>Classifier:</span><span className="text-slate-800 font-bold">TF-IDF + LogReg</span></div>
          <div className="flex justify-between"><span>Base Templates:</span><span className="text-slate-800 font-bold">{mlStats ? mlStats.default_samples : 49}</span></div>
          <div className="flex justify-between"><span>User Corrections:</span><span className="text-slate-800 font-bold">{mlStats ? mlStats.user_samples : transactions.filter((t) => t.category_id !== null).length}</span></div>
          <div className="flex justify-between border-t border-slate-200/50 pt-1"><span>Total Dataset:</span><span className="text-slate-800 font-bold">{mlStats ? mlStats.total_samples : 49 + transactions.filter((t) => t.category_id !== null).length}</span></div>
          {mlStats?.last_trained && <div className="flex justify-between"><span>Last Trained:</span><span className="text-slate-800 font-bold">{mlStats.last_trained}</span></div>}
        </div>
        {pendingRetrain && (
          <div className="p-3 rounded-default bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 mt-4">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10.5px] text-amber-700">Model outdated — new corrections available. Retrain to improve accuracy.</p>
          </div>
        )}
        <button
          onClick={handleRetrainModel}
          disabled={mlTraining}
          className={`w-full py-2.5 mt-4 text-xs font-bold text-white rounded-default cursor-pointer transition-all active:scale-[0.98] ${
            pendingRetrain ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-[#00522b]'
          } disabled:opacity-50 shadow-[0_2px_6px_rgba(0,0,0,0.08)]`}
        >
          {mlTraining ? (
            <span className="flex items-center justify-center gap-2"><span className="border-2 border-white border-t-transparent w-3.5 h-3.5 rounded-full animate-spin" /> Retraining...</span>
          ) : 'Retrain AI Model'}
        </button>
      </div>
    </div>
  );
}
