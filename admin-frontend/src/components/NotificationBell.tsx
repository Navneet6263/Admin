import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Clock3, X } from "lucide-react";
import { request, type Paged } from "@/lib/api";
import { fmtDateTime, relTime } from "./requestMeta";

interface Notice {
  id: number;
  message: string;
  kind: string;
  action_url?: string;
  due_at?: string;
  is_read: boolean;
  created_at: string;
}
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try {
      const r = await request<Paged<Notice> & { unread: number }>(
        "/api/notifications?page_size=20",
      );
      setItems(r.data);
    } catch {
      /* session may be changing */
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 45000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const read = async (n: Notice) => {
    if (!n.is_read) {
      await request(`/api/notifications/${n.id}/read`, { method: "PATCH" });
      setItems((x) => x.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
    }
    if (n.action_url) window.location.assign(n.action_url);
  };
  const all = async () => {
    await request("/api/notifications/read-all", { method: "POST" });
    setItems((x) => x.map((i) => ({ ...i, is_read: true })));
  };
  const unread = items.filter((i) => !i.is_read).length;
  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 grid place-items-center rounded-md hover:bg-slate-100 text-slate-500 relative"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-[360px] max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between">
            <div>
              <b className="text-sm">Notifications</b>
              <p className="text-[10px] text-slate-400">Live approvals, payments and reminders</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => void all()}
                title="Mark all read"
                className="p-2 hover:bg-slate-100 rounded"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => void read(n)}
                className={`w-full text-left p-3 border-b border-slate-100 hover:bg-slate-50 flex gap-3 ${n.is_read ? "opacity-65" : "bg-indigo-50/40"}`}
              >
                <span
                  className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.is_read ? "bg-slate-300" : "bg-indigo-500"}`}
                />
                <span>
                  <span className="text-xs text-slate-700 block">{n.message}</span>
                  <span
                    className="text-[10px] text-slate-400 mt-1 flex gap-1"
                    title={fmtDateTime(n.created_at)}
                  >
                    <Clock3 className="w-3 h-3" />
                    {relTime(n.created_at)} · {fmtDateTime(n.created_at)}
                  </span>
                </span>
              </button>
            ))}
            {!items.length && (
              <div className="p-10 text-center text-xs text-slate-400">You are all caught up.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
