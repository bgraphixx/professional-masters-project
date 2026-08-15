import { useState } from 'react';
import './App.css';
import { apiGet, apiPost } from './api';
import { useAsyncEffect } from './hooks';
import { formatNaira } from './utils';
import type { TabId, UserProfile } from './types';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import OverviewTab from './components/OverviewTab';
import TransactionsTab from './components/TransactionsTab';
import BudgetsTab from './components/BudgetsTab';
import InsightsTab from './components/InsightsTab';
import SettingsTab from './components/SettingsTab';
import AdminTab from './components/AdminTab';

const TAB_TITLES: Partial<Record<TabId, string>> = {
  overview: 'Financial Overview',
  insights: 'AI Insights & ML Model',
};

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Shared between TransactionsTab (sets it after a manual category correction)
  // and SettingsTab's ML console (reads it to prompt a retrain).
  const [pendingRetrain, setPendingRetrain] = useState(false);

  useAsyncEffect(async () => {
    const { ok, data } = await apiGet<UserProfile>('/auth/me');
    if (ok) setUser(data);
  }, []);

  const handleLogout = async () => {
    await apiPost('/auth/logout');
    setUser(null);
    setActiveTab('overview');
  };

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />;
  }

  return (
    <div className="min-h-screen bg-background flex text-on-background font-sans">
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {/* Header section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-on-background capitalize">
                {TAB_TITLES[activeTab] ?? activeTab}
              </h1>
              <p className="text-sm text-slate-500">
                {activeTab === 'overview' && `Welcome back, ${user.full_name}. Here is your financial health status.`}
                {activeTab === 'transactions' && 'Manage manual and imported financial statements.'}
                {activeTab === 'budgets' && 'Set monthly spending limits and track your category budgets.'}
                {activeTab === 'insights' && 'AI-generated alerts, trend analysis, and recommendations.'}
                {activeTab === 'admin' && 'User oversight, category taxonomy, and ML model health.'}
              </p>
            </div>

            <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-start">
              {activeTab === 'overview' && (
                <div className="bg-surface-low border border-outline-variant/40 px-3 py-1.5 rounded-default flex items-center gap-2">
                  <span className="font-mono text-label-sm text-slate-500 uppercase">Monthly Income:</span>
                  <span className="font-semibold text-sm">{formatNaira(user.monthly_income)}</span>
                </div>
              )}
            </div>
          </div>

          {activeTab === 'overview' && <OverviewTab setActiveTab={setActiveTab} />}
          {activeTab === 'transactions' && <TransactionsTab onCategoryCorrected={() => setPendingRetrain(true)} />}
          {activeTab === 'budgets' && <BudgetsTab />}
          {activeTab === 'insights' && <InsightsTab user={user} />}
          {activeTab === 'settings' && (
            <SettingsTab
              user={user}
              onUserUpdated={setUser}
              pendingRetrain={pendingRetrain}
              setPendingRetrain={setPendingRetrain}
            />
          )}
          {activeTab === 'admin' && user.is_admin && <AdminTab />}
        </main>
      </div>
    </div>
  );
}

export default App;
