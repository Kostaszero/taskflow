import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { auth } from '../utils/api';
import { useAuthContext } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';

type FormMode = 'login' | 'register';

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<FormMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  
  const { isLoading: authLoading, token, login } = useAuthContext();
  const navigate = useNavigate();

  if (authLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (token) return <Navigate to="/projects" />;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let response;
      if (mode === 'login') {
        response = await auth.login(formData.email, formData.password);
      } else {
        response = await auth.register(formData.name, formData.email, formData.password);
      }

      const { token, user } = response.data;
      login(user, token);
      navigate('/projects');
    } catch (err: any) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_35%),linear-gradient(135deg,_#f8fafc,_#e2e8f0)] px-4 py-10">
      <div className="mx-auto grid min-h-[80vh] max-w-5xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden lg:block">
          <div className="mb-6 inline-flex rounded-full border border-slate-300 bg-white/70 px-4 py-1 text-sm text-slate-700 shadow-sm backdrop-blur">
            Full-stack task orchestration
          </div>
          <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-slate-950">
            Run projects with a calmer, sharper workflow.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-slate-600">
            TaskFlow gives you projects, ownership, and execution status in one place without the noise.
          </p>
        </div>

        <Card className="border-slate-200/80 bg-white/90 shadow-2xl shadow-slate-300/30 backdrop-blur">
          <CardHeader className="space-y-3">
            <CardTitle className="text-3xl">TaskFlow</CardTitle>
            <CardDescription>
              Sign in or create an account to manage projects and tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          <Button
            onClick={() => setMode('login')}
            variant={mode === 'login' ? 'default' : 'ghost'}
            className={`w-full ${
              mode === 'login'
                ? 'shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Login
          </Button>
          <Button
            onClick={() => setMode('register')}
            variant={mode === 'register' ? 'default' : 'ghost'}
            className={`w-full ${
              mode === 'register'
                ? 'shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Register
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <Input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          )}

          <Input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleInputChange}
            required
          />

          <Input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleInputChange}
            required
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Login' : 'Register'}
          </Button>
        </form>

        {mode === 'login' && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium mb-2">Demo credentials:</p>
            <p>Email: test@example.com</p>
            <p>Password: password123</p>
          </div>
        )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
