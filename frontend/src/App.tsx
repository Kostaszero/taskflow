import React from 'react';
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuthContext } from './hooks/useAuth';
import { AuthPage } from './pages/AuthPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

const AppShell: React.FC = () => {
  const { user, logout } = useAuthContext();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {user && (
        <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Link to="/" className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                TF
              </Link>
              <Link to="/" className="no-underline">
                <h1 className="text-lg font-semibold text-slate-950">TaskFlow</h1>
                <p className="text-sm text-slate-500">Project and task command center</p>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">Hello, <b>{user.name}!</b></span>
              <button
                onClick={() => {
                  logout();
                  window.location.href = '/login';
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          </div>
        </header>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

const ProtectedRoute: React.FC = () => {
  const { user } = useAuthContext();

  if (!user || !localStorage.getItem('token')) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell />;
};

export const App: React.FC = () => {
  const { isLoading, user } = useAuthContext();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/projects" replace /> : <AuthPage />} />
      <Route path="/register" element={user ? <Navigate to="/projects" replace /> : <AuthPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/projects' : '/login'} replace />} />
    </Routes>
  );
};

export default App;
