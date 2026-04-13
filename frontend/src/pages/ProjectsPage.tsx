import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { projects } from '../utils/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export const ProjectsPage: React.FC = () => {
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await projects.list();
      setProjectsList(response.data.projects || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await projects.create(formData.name, formData.description);
      setFormData({ name: '', description: '' });
      setShowCreateForm(false);
      await loadProjects();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create project');
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Delete this project and all its tasks?')) return;
    try {
      await projects.delete(id);
      await loadProjects();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete project');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading projects...</div>;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Workspace</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Projects</h1>
          <p className="mt-2 text-slate-600">Open a project to create and move tasks across its execution stages.</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          size="lg"
        >
          New Project
        </Button>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>}

      {showCreateForm && (
        <Card className="mb-6 border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Create Project</CardTitle>
            <CardDescription>Start a new project space and add tasks inside it.</CardDescription>
          </CardHeader>
          <CardContent>
          <form onSubmit={handleCreateProject} className="space-y-3">
            <Input
              type="text"
              placeholder="Project name"
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              required
            />
            <Textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              rows={3}
            />
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button type="button" variant="secondary" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </form>
          </CardContent>
        </Card>
      )}

      {projectsList.length === 0 ? (
        <Card className="border-dashed border-slate-300 bg-slate-50/80 py-12 text-center">
          <CardContent>
          <p className="text-slate-500 mb-4">No projects yet</p>
          <Button onClick={() => setShowCreateForm(true)}>Create Your First Project</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectsList.map(project => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="no-underline"
            >
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <CardDescription>{project.description || 'No description yet.'}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between pt-0">
                  <span className="text-xs text-slate-500">Open project</span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteProject(project.id);
                    }}
                  >
                    Delete
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
