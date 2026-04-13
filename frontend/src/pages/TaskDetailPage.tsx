import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage, projects, tasks } from '../utils/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  tasks: Task[];
  assignable_users?: UserOption[];
}

interface EditFormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assignee_name: string;
  due_date: string;
  status: 'todo' | 'in_progress' | 'done';
}

export const TaskDetailPage: React.FC = () => {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigneeMenuOpen, setIsAssigneeMenuOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    title: '',
    description: '',
    priority: 'medium',
    assignee_name: '',
    due_date: '',
    status: 'todo',
  });

  useEffect(() => {
    const loadTask = async () => {
      try {
        setLoading(true);
        const response = await projects.get(id!);
        const loadedProject = response.data as Project;
        const selectedTask = loadedProject.tasks.find((item: Task) => item.id === taskId) || null;

        setProject(loadedProject);
        setTask(selectedTask);
        if (selectedTask) {
          const assigneeName = selectedTask.assignee_id
            ? loadedProject.assignable_users?.find((userOption: UserOption) => userOption.id === selectedTask.assignee_id)?.name || ''
            : '';

          setEditFormData({
            title: selectedTask.title,
            description: selectedTask.description || '',
            priority: selectedTask.priority,
            assignee_name: assigneeName,
            due_date: selectedTask.due_date || '',
            status: selectedTask.status,
          });
        }
        setError(null);
      } catch (err: any) {
        setError(getApiErrorMessage(err, 'Failed to load task'));
      } finally {
        setLoading(false);
      }
    };

    void loadTask();
  }, [id, taskId]);

  const formatDate = (value: string | null) => {
    if (!value) {
      return 'Not set';
    }

    return new Date(value).toLocaleString();
  };

  const getAssigneeLabel = () => {
    if (!task?.assignee_id) {
      return 'Unassigned';
    }

    const match = project?.assignable_users?.find((userOption: UserOption) => userOption.id === task.assignee_id);
    return match ? `${match.name} (${match.email})` : 'Assigned';
  };

  const getStatusLabel = (status: string) => {
    return status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
  };

  const resolveAssigneeId = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    const match = project?.assignable_users?.find((userOption: UserOption) => {
      const normalizedValue = trimmedValue.toLowerCase();
      return userOption.name.toLowerCase() === normalizedValue || userOption.email.toLowerCase() === normalizedValue;
    });

    return match?.id || null;
  };

  const getMatchingUsers = (query: string) => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return [] as UserOption[];
    }

    return (project?.assignable_users || [])
      .filter((userOption: UserOption) =>
        userOption.name.toLowerCase().includes(normalizedQuery) ||
        userOption.email.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 5);
  };

  const selectAssignee = (name: string) => {
    setEditFormData((current: EditFormData) => ({ ...current, assignee_name: name }));
    setIsAssigneeMenuOpen(false);
  };

  const startEditing = () => {
    if (!task) {
      return;
    }

    const assigneeName = task.assignee_id
      ? project?.assignable_users?.find((userOption: UserOption) => userOption.id === task.assignee_id)?.name || ''
      : '';

    setEditFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      assignee_name: assigneeName,
      due_date: task.due_date || '',
      status: task.status,
    });
    setIsEditing(true);
    setIsAssigneeMenuOpen(false);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setIsAssigneeMenuOpen(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!task) {
      return;
    }

    const assigneeId = resolveAssigneeId(editFormData.assignee_name);

    if (editFormData.assignee_name.trim() && !assigneeId) {
      setError('Assignee must match an existing user name or email.');
      return;
    }

    const updates: Record<string, string | null> = {};

    if (editFormData.title !== task.title) {
      updates.title = editFormData.title;
    }
    if (editFormData.description !== (task.description || '')) {
      updates.description = editFormData.description || null;
    }
    if (editFormData.priority !== task.priority) {
      updates.priority = editFormData.priority;
    }
    if (editFormData.status !== task.status) {
      updates.status = editFormData.status;
    }
    if ((editFormData.due_date || null) !== task.due_date) {
      updates.due_date = editFormData.due_date || null;
    }
    if ((assigneeId || null) !== task.assignee_id) {
      updates.assignee_id = assigneeId || null;
    }

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      const response = await tasks.update(task.id, updates);
      const updatedTask = response.data as Task;

      setTask(updatedTask);
      setProject((currentProject: Project | null) => {
        if (!currentProject) {
          return currentProject;
        }

        return {
          ...currentProject,
          tasks: currentProject.tasks.map((item: Task) => (item.id === updatedTask.id ? updatedTask : item)),
        };
      });
      setIsEditing(false);
      setIsAssigneeMenuOpen(false);
      setError(null);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to update task'));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading task...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  if (!project || !task) {
    return <div className="p-8 text-center">Task not found</div>;
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link to="/projects" className="hover:text-slate-900">Projects</Link>
          <span>/</span>
          <Link to={`/projects/${project.id}`} className="hover:text-slate-900">{project.name}</Link>
          <span>/</span>
          <span className="text-slate-900">{task.title}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Task Details</p>
            {isEditing ? (
              <div className="mt-2 space-y-3">
                <Input
                  value={editFormData.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData((current: EditFormData) => ({ ...current, title: e.target.value }))}
                  className="h-12 text-3xl font-semibold tracking-tight"
                />
                <Textarea
                  value={editFormData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditFormData((current: EditFormData) => ({ ...current, description: e.target.value }))}
                  rows={5}
                  className="max-w-3xl"
                />
              </div>
            ) : (
              <>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{task.title}</h1>
                <p className="mt-3 max-w-3xl text-slate-600">
                  {task.description || 'No description provided for this task yet.'}
                </p>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button type="button" variant="outline" onClick={cancelEditing} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={startEditing}>
                Edit Task
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => navigate(`/projects/${project.id}`)}>
              Back To Board
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_360px]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Description</h2>
              {isEditing ? (
                <Textarea
                  value={editFormData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditFormData((current: EditFormData) => ({ ...current, description: e.target.value }))}
                  rows={10}
                  className="min-h-[220px]"
                />
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {task.description || 'No description added.'}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Timeline</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Created</p>
                  <p className="mt-2 text-sm text-slate-900">{formatDate(task.created_at)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Last Updated</p>
                  <p className="mt-2 text-sm text-slate-900">{formatDate(task.updated_at)}</p>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Status</p>
                {isEditing ? (
                  <select
                    value={editFormData.status}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditFormData((current: EditFormData) => ({ ...current, status: e.target.value as EditFormData['status'] }))}
                    className="mt-2 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                ) : (
                  <div className="mt-2">
                    <Badge className="bg-slate-100 text-slate-700">{getStatusLabel(task.status)}</Badge>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Priority</p>
                {isEditing ? (
                  <select
                    value={editFormData.priority}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditFormData((current: EditFormData) => ({ ...current, priority: e.target.value as EditFormData['priority'] }))}
                    className="mt-2 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                ) : (
                  <div className="mt-2">
                    <Badge className={`${
                      task.priority === 'high' ? 'bg-red-100 text-red-700' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {task.priority}
                    </Badge>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Assignee</p>
                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <Input
                      value={editFormData.assignee_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setEditFormData((current: EditFormData) => ({ ...current, assignee_name: e.target.value }));
                        setIsAssigneeMenuOpen(true);
                      }}
                      onFocus={() => setIsAssigneeMenuOpen(true)}
                      onBlur={() => setTimeout(() => setIsAssigneeMenuOpen(false), 120)}
                      placeholder="Type a name"
                    />
                    {isAssigneeMenuOpen && editFormData.assignee_name.trim() && (
                      <div className="rounded-md border border-slate-300 bg-white shadow-md max-h-48 overflow-y-auto">
                        {getMatchingUsers(editFormData.assignee_name).length > 0
                          ? getMatchingUsers(editFormData.assignee_name).map((userOption: UserOption, index: number) => (
                              <button
                                key={userOption.id}
                                type="button"
                                onMouseDown={(e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault()}
                                onClick={() => selectAssignee(userOption.name)}
                                className={`w-full text-left px-3 py-2 text-sm transition ${
                                  editFormData.assignee_name === userOption.name ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                                } ${index !== getMatchingUsers(editFormData.assignee_name).length - 1 ? 'border-b border-slate-200' : ''}`}
                              >
                                <div className="font-medium">{userOption.name}</div>
                                <div className="text-xs text-slate-500">{userOption.email}</div>
                              </button>
                            ))
                          : <div className="px-3 py-2 text-xs text-slate-500">No matching users</div>}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-900">{getAssigneeLabel()}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Due Date</p>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editFormData.due_date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData((current: EditFormData) => ({ ...current, due_date: e.target.value }))}
                    className="mt-2"
                  />
                ) : (
                  <p className="mt-2 text-sm text-slate-900">{formatDate(task.due_date)}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p className="font-medium text-slate-900">{project.name}</p>
              <p>{project.description || 'No project description available.'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};