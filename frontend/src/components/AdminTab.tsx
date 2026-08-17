import { useState } from 'react';
import { User as UserIcon, Plus } from 'lucide-react';
import { apiGet, apiPost, apiErrorDetail } from '../api';
import { useAsyncEffect } from '../hooks';
import type { AdminUser, AdminUserListResponse, AdminMlMetrics, Category } from '../types';

const ADMIN_USERS_PAGE_SIZE = 10;

function errorMessageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export default function AdminTab() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersTotal, setAdminUsersTotal] = useState(0);
  const [adminUsersPage, setAdminUsersPage] = useState(0);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);

  const [adminCategories, setAdminCategories] = useState<Category[]>([]);
  const [adminCategoriesLoading, setAdminCategoriesLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');
  const [adminCategorySaving, setAdminCategorySaving] = useState(false);

  const [adminMlMetrics, setAdminMlMetrics] = useState<AdminMlMetrics | null>(null);
  const [adminMlMetricsLoading, setAdminMlMetricsLoading] = useState(false);

  const fetchAdminUsers = async () => {
    setAdminUsersLoading(true);
    try {
      const { ok, data } = await apiGet<AdminUserListResponse>(`/admin/users?skip=${adminUsersPage * ADMIN_USERS_PAGE_SIZE}&limit=${ADMIN_USERS_PAGE_SIZE}`);
      if (ok) {
        setAdminUsers(data.users);
        setAdminUsersTotal(data.total);
      }
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const fetchAdminCategories = async () => {
    setAdminCategoriesLoading(true);
    try {
      const { ok, data } = await apiGet<Category[]>('/admin/categories');
      if (ok) setAdminCategories(data);
    } finally {
      setAdminCategoriesLoading(false);
    }
  };

  const fetchAdminMlMetrics = async () => {
    setAdminMlMetricsLoading(true);
    try {
      const { ok, data } = await apiGet<AdminMlMetrics>('/admin/ml/metrics');
      if (ok) setAdminMlMetrics(data);
    } finally {
      setAdminMlMetricsLoading(false);
    }
  };

  useAsyncEffect(async () => {
    fetchAdminCategories();
    fetchAdminMlMetrics();
  }, []);

  useAsyncEffect(fetchAdminUsers, [adminUsersPage]);

  const handleCreateAdminCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminCategorySaving(true);
    try {
      const { ok, data } = await apiPost<Category>('/admin/categories', { name: newCategoryName, type: newCategoryType });
      if (!ok) throw new Error(apiErrorDetail(data, 'Failed to create category'));
      setNewCategoryName('');
      fetchAdminCategories();
    } catch (err) {
      alert(errorMessageOf(err, 'Failed to create category'));
    } finally {
      setAdminCategorySaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Users table */}
      <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
        <div className="border-b border-surface-container pb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">User Oversight</h3>
          <p className="text-xs text-slate-500 mt-0.5">All registered accounts, newest first.</p>
        </div>

        <div className="overflow-x-auto">
          {adminUsersLoading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading users…</div>
          ) : adminUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <UserIcon className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-sm font-medium">No users found.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-outline-variant text-slate-400 text-[10px] font-mono uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Email</th>
                  <th className="pb-3 font-semibold">Full Name</th>
                  <th className="pb-3 font-semibold">Joined</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => (
                  <tr key={u.id} className="border-b border-surface-container/60 hover:bg-slate-50/40 transition-colors">
                    <td className="py-4 text-sm font-mono text-slate-600">{u.email}</td>
                    <td className="py-4 text-sm font-medium text-on-background">{u.full_name}</td>
                    <td className="py-4 text-sm font-mono text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-4">
                      <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded uppercase bg-primary/10 text-primary border border-primary/10">
                        {u.status}
                      </span>
                    </td>
                    <td className="py-4 text-right font-mono font-medium text-sm text-slate-800">{u.transaction_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {adminUsersTotal > ADMIN_USERS_PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-surface-container pt-4 mt-4">
            <span className="text-xs text-slate-500">
              Showing {adminUsersPage * ADMIN_USERS_PAGE_SIZE + 1} to {Math.min((adminUsersPage + 1) * ADMIN_USERS_PAGE_SIZE, adminUsersTotal)} of {adminUsersTotal} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAdminUsersPage((p) => Math.max(0, p - 1))}
                disabled={adminUsersPage === 0}
                className="px-3 py-1.5 border border-outline-variant rounded-default text-xs font-medium hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs font-medium text-slate-700">
                Page {adminUsersPage + 1} of {Math.ceil(adminUsersTotal / ADMIN_USERS_PAGE_SIZE)}
              </span>
              <button
                onClick={() => setAdminUsersPage((p) => ((p + 1) * ADMIN_USERS_PAGE_SIZE < adminUsersTotal ? p + 1 : p))}
                disabled={(adminUsersPage + 1) * ADMIN_USERS_PAGE_SIZE >= adminUsersTotal}
                className="px-3 py-1.5 border border-outline-variant rounded-default text-xs font-medium hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories manager */}
        <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
          <div className="border-b border-surface-container pb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Category Taxonomy</h3>
            <p className="text-xs text-slate-500 mt-0.5">All categories available to every user.</p>
          </div>

          <form onSubmit={handleCreateAdminCategory} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1 px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
            <select
              value={newCategoryType}
              onChange={(e) => setNewCategoryType(e.target.value as 'income' | 'expense')}
              className="bg-surface-lowest border border-outline-variant text-slate-700 text-sm rounded-default py-2 px-3 outline-none cursor-pointer focus:border-secondary"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <button
              type="submit"
              disabled={adminCategorySaving}
              className="bg-primary hover:bg-[#00522b] text-white px-3.5 py-2 rounded-default text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </form>

          <div className="max-h-80 overflow-y-auto space-y-1.5 pt-1">
            {adminCategoriesLoading ? (
              <div className="text-center py-6 text-slate-400 text-sm">Loading categories…</div>
            ) : adminCategories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-default bg-surface-low border border-outline-variant/30">
                <span className="text-sm font-medium text-on-background">{cat.name}</span>
                <div className="flex items-center gap-2">
                  {cat.is_default && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-500 border border-slate-200">Default</span>
                  )}
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border ${
                    cat.type === 'income'
                      ? 'bg-primary/10 text-primary border-primary/10'
                      : 'bg-tertiary/10 text-tertiary border-tertiary/10'
                  }`}>
                    {cat.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ML metrics card */}
        <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
          <div className="border-b border-surface-container pb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">ML Model Health</h3>
            <p className="text-xs text-slate-500 mt-0.5">From the last seed script training run.</p>
          </div>

          {adminMlMetricsLoading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Loading metrics…</div>
          ) : adminMlMetrics ? (
            <div className="space-y-1 font-mono text-[10px] text-slate-500 bg-surface-low border border-outline-variant/40 rounded p-3">
              <div className="flex justify-between flex-wrap gap-x-2 gap-y-0.5"><span>Train Samples:</span><span className="text-slate-800 font-bold">{adminMlMetrics.train_samples ?? '—'}</span></div>
              <div className="flex justify-between flex-wrap gap-x-2 gap-y-0.5"><span>Validation Samples:</span><span className="text-slate-800 font-bold">{adminMlMetrics.validation_samples ?? '—'}</span></div>
              <div className="flex justify-between flex-wrap gap-x-2 gap-y-0.5"><span>Test Samples:</span><span className="text-slate-800 font-bold">{adminMlMetrics.test_samples ?? '—'}</span></div>
              <div className="flex justify-between flex-wrap gap-x-2 gap-y-0.5 border-t border-slate-200/50 pt-1"><span>Train Accuracy:</span><span className="text-primary font-bold">{adminMlMetrics.train_accuracy != null ? `${(adminMlMetrics.train_accuracy * 100).toFixed(1)}%` : '—'}</span></div>
              <div className="flex justify-between flex-wrap gap-x-2 gap-y-0.5"><span>Validation Accuracy:</span><span className="text-secondary font-bold">{adminMlMetrics.validation_accuracy != null ? `${(adminMlMetrics.validation_accuracy * 100).toFixed(1)}%` : '—'}</span></div>
              <div className="flex justify-between flex-wrap gap-x-2 gap-y-0.5"><span>Test Accuracy:</span><span className="text-secondary font-bold">{adminMlMetrics.test_accuracy != null ? `${(adminMlMetrics.test_accuracy * 100).toFixed(1)}%` : '—'}</span></div>
              <div className="flex justify-between flex-wrap gap-x-2 gap-y-0.5 border-t border-slate-200/50 pt-1"><span>Training Corpus:</span><span className="text-slate-800 font-bold">{adminMlMetrics.total_training_corpus_size ?? '—'}</span></div>
              <div className="flex justify-between flex-wrap gap-x-2 gap-y-0.5"><span>Trained At:</span><span className="text-slate-800 font-bold">{adminMlMetrics.trained_at ? new Date(adminMlMetrics.trained_at).toLocaleString() : '—'}</span></div>
              <div className="flex justify-between flex-wrap gap-x-2 gap-y-0.5"><span>Model File:</span><span className="text-slate-800 font-bold">{adminMlMetrics.model_file_size_bytes != null ? `${(adminMlMetrics.model_file_size_bytes / 1024).toFixed(1)} KB` : '—'}</span></div>
              <div className="flex justify-between flex-wrap gap-x-2 gap-y-0.5"><span>Model Updated:</span><span className="text-slate-800 font-bold">{adminMlMetrics.model_file_timestamp ? new Date(adminMlMetrics.model_file_timestamp).toLocaleString() : '—'}</span></div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">No metrics available yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
