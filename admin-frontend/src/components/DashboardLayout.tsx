import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, Search, Command, X } from "lucide-react";
import type { ReactNode } from "react";
import { NotificationBell } from "./NotificationBell";

export interface WorkspaceTab {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number | string;
}
export interface SearchSuggestion { id: string; label: string; meta?: string; value?: string; }

interface Props {
  children: ReactNode;
  currentUser: string;
  role?: string;
  workspace: string;                 // e.g. "Admin Console"
  tabs?: WorkspaceTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  rightSlot?: ReactNode;             // per-workspace actions (e.g. "New request")
  headerActions?: ReactNode;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  searchSuggestions?: SearchSuggestion[];
}

export function DashboardLayout({
  children, currentUser, role = "Administrator",
  workspace, tabs = [], activeTab, onTabChange, rightSlot, headerActions,
  searchQuery = "", onSearchChange, searchPlaceholder = "Search requests, employees, IDs…", searchSuggestions = [],
}: Props) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false); const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const initials = currentUser.split(" ").map((n) => n[0]).join("").slice(0, 2);

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  useEffect(() => setActiveSuggestion(-1), [searchQuery]);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 flex flex-col">
      {/* Top bar: brand + search + user */}
      <header className="h-14 border-b border-slate-200/70 bg-white sticky top-0 z-30 flex items-center gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-slate-900 grid place-items-center">
            <Command className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 leading-none">
            <p className="font-display font-semibold text-sm">RequestHub</p>
            <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-0.5">{workspace}</p>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-lg">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && searchSuggestions.length) { event.preventDefault(); setSearchOpen(true); setActiveSuggestion((value) => Math.min(value + 1, searchSuggestions.length - 1)); }
                else if (event.key === "ArrowUp" && searchSuggestions.length) { event.preventDefault(); setActiveSuggestion((value) => Math.max(value - 1, 0)); }
                else if (event.key === "Enter" && activeSuggestion >= 0) { event.preventDefault(); const suggestion = searchSuggestions[activeSuggestion]; onSearchChange?.(suggestion.value ?? suggestion.label); setSearchOpen(false); }
                else if (event.key === "Escape") { setSearchOpen(false); searchInputRef.current?.blur(); }
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-300 focus:bg-white transition-all"
            />
            {searchQuery ? (
              <button
                onClick={() => onSearchChange?.("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-white border border-slate-200 text-slate-400 rounded text-[9px] font-mono pointer-events-none">⌘K</kbd>
            )}
            {searchOpen && searchQuery.trim() && searchSuggestions.length > 0 && <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-100 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Suggestions</div>
              {searchSuggestions.slice(0, 8).map((suggestion, index) => <button key={suggestion.id} type="button" onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveSuggestion(index)} onClick={() => { onSearchChange?.(suggestion.value ?? suggestion.label); setSearchOpen(false); }}
                className={`flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2.5 text-left last:border-0 ${activeSuggestion === index ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">{suggestion.label}</span>{suggestion.meta && <span className="mt-0.5 block truncate text-[10px] text-slate-400">{suggestion.meta}</span>}</span>
              </button>)}
            </div>}
          </div>
        </div>

        {headerActions && <div className="hidden lg:flex shrink-0 items-center gap-2">{headerActions}</div>}

        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 grid place-items-center text-[10px] font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-medium text-slate-800 truncate max-w-[140px]">{currentUser}</p>
              <p className="text-[10px] text-slate-400">{role}</p>
            </div>
          </div>
          <Link to="/" className="w-8 h-8 grid place-items-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-900" title="Switch role">
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
          </Link>
        </div>
      </header>

      {/* Workspace tab bar (Flipkart-style horizontal categories) */}
      {tabs.length > 0 && (
        <div className="bg-white border-b border-slate-200/70 sticky top-14 z-20">
          <div className="flex items-center gap-1 px-2 sm:px-4 overflow-x-auto">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = t.key === activeTab;
                return (
                  <button
                    key={t.key}
                    onClick={() => onTabChange?.(t.key)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                      active
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />}
                    {t.label}
                    {t.badge !== undefined && t.badge !== 0 && (
                      <span className={`ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold ${
                        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                      }`}>{t.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {rightSlot && <div className="shrink-0 pl-2 py-1.5">{rightSlot}</div>}
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
