import { Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { session, type SessionUser } from '@/lib/api';

type AppRole =
  | 'employee'
  | 'admin'
  | 'hq_admin'
  | 'center_admin'
  | 'finance'
  | 'finance_head'
  | 'verifier'
  | 'super_admin';

const homeByRole: Record<AppRole, string> = {
  employee: '/employee',
  admin: '/admin',
  hq_admin: '/admin',
  center_admin: '/center-admin',
  finance: '/finance',
  finance_head: '/finance',
  verifier: '/verifier',
  super_admin: '/super-admin',
};

function validRole(user: SessionUser, roles: AppRole[]) {
  return roles.includes(user.role as AppRole);
}

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles: AppRole[] }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    void session.me().then((user) => {
      if (!active) return;
      if (user && validRole(user, roles)) {
        setAllowed(true);
        return;
      }
      const destination = user ? homeByRole[user.role as AppRole] || '/' : '/';
      window.location.replace(destination);
    });
    return () => { active = false; };
  }, [roles]);

  if (allowed) return children;
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-7 w-7 text-slate-700" />
        <p className="mt-3 text-sm font-semibold text-slate-800">Checking secure access</p>
        <p className="mt-1 text-xs text-slate-500">Your session and role are being verified.</p>
        <Loader2 className="mx-auto mt-4 h-4 w-4 animate-spin text-slate-500" />
      </div>
    </div>
  );
}

export function protectedRoute(Page: ComponentType, roles: AppRole[]) {
  return function SecuredPage() {
    return <ProtectedRoute roles={roles}><Page /></ProtectedRoute>;
  };
}
