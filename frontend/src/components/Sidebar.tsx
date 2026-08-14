import {
  Wallet, LogOut, Menu, X, ChevronLeft, ChevronRight,
  LayoutDashboard, FileSpreadsheet, PiggyBank, Sparkles, Settings, ShieldCheck,
} from 'lucide-react';
import type { TabId, UserProfile } from '../types';

interface SidebarProps {
  user: UserProfile;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (v: boolean) => void;
  onLogout: () => void;
}

const NAV_ITEMS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: FileSpreadsheet },
  { id: 'budgets', label: 'Budgets', icon: PiggyBank },
  { id: 'insights', label: 'AI Insights & ML', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const MOBILE_NAV_ITEMS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: FileSpreadsheet },
  { id: 'budgets', label: 'Budgets', icon: PiggyBank },
  { id: 'insights', label: 'AI Insights & ML', icon: Sparkles },
];

export default function Sidebar({
  user, activeTab, setActiveTab,
  isSidebarCollapsed, setIsSidebarCollapsed,
  isMobileMenuOpen, setIsMobileMenuOpen,
  onLogout,
}: SidebarProps) {
  const desktopItems = [...NAV_ITEMS, ...(user.is_admin ? [{ id: 'admin' as TabId, label: 'Admin', icon: ShieldCheck }] : [])];
  const mobileItems = [...MOBILE_NAV_ITEMS, ...(user.is_admin ? [{ id: 'admin' as TabId, label: 'Admin', icon: ShieldCheck }] : [])];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col bg-surface-lowest border-r border-outline-variant/30 h-screen sticky top-0 transition-all duration-300 z-30 shrink-0 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-5 flex items-center justify-between border-b border-outline-variant/20">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-default bg-primary flex items-center justify-center shadow-[0_4px_10px_rgba(0,106,57,0.15)]">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              <span className="font-sans font-bold text-xl tracking-tight text-on-background">
                Naira<span className="text-primary">AI</span>
              </span>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="w-8 h-8 rounded-default bg-primary flex items-center justify-center shadow-[0_4px_10px_rgba(0,106,57,0.15)] mx-auto">
              <Wallet className="w-4 h-4 text-white" />
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`p-1.5 rounded-default hover:bg-surface-low border border-outline-variant/30 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer ${isSidebarCollapsed ? 'mx-auto' : ''}`}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {desktopItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-default font-semibold text-sm transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-white shadow-[0_2px_8px_rgba(0,106,57,0.15)]'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-surface-low'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                title={item.label}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-outline-variant/20 space-y-3 bg-surface-lowest">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-container/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-on-background truncate">{user.full_name}</p>
                <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary-container/20 flex items-center justify-center text-primary font-bold text-sm mx-auto" title={user.full_name}>
              {user.full_name.charAt(0).toUpperCase()}
            </div>
          )}

          <button
            onClick={onLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-default font-semibold text-xs text-slate-600 hover:text-error hover:bg-error-container/10 transition-colors border border-transparent hover:border-error/20 cursor-pointer ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-surface-lowest border-b border-outline-variant/30 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-default bg-primary flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <span className="font-sans font-bold text-lg tracking-tight text-on-background">
            Naira<span className="text-primary">AI</span>
          </span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 rounded-default border border-outline-variant/30 hover:bg-surface-low text-slate-600 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile Menu Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="w-64 bg-surface-lowest h-full flex flex-col transition-all duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-default bg-primary flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <span className="font-sans font-bold text-lg tracking-tight text-on-background">
                  Naira<span className="text-primary">AI</span>
                </span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-default border border-outline-variant/30 hover:bg-surface-low text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              {mobileItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-default font-semibold text-sm transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary text-white shadow-[0_2px_8px_rgba(0,106,57,0.15)]'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-surface-low'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-outline-variant/20 space-y-3 bg-surface-lowest">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-container/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-on-background truncate">{user.full_name}</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-default font-semibold text-xs text-slate-600 hover:text-error hover:bg-error-container/10 transition-colors border border-transparent hover:border-error/20 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-slate-500" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
