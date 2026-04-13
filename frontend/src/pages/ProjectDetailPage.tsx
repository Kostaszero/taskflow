import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiErrorMessage, projects, tasks, users } from '../utils/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
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

interface TaskFormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assignee_name: string;
  due_date: string;
}

interface EditFormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assignee_name: string;
  due_date: string;
  status: 'todo' | 'in_progress' | 'done';
}

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'todo' | 'in_progress' | 'done' | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [formData, setFormData] = useState<TaskFormData>({ title: '', description: '', priority: 'medium', assignee_name: '', due_date: '' });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({ title: '', description: '', priority: 'medium', assignee_name: '', due_date: '', status: 'todo' });
  const [isCreateAssigneeMenuOpen, setIsCreateAssigneeMenuOpen] = useState(false);
  const [isEditAssigneeMenuOpen, setIsEditAssigneeMenuOpen] = useState(false);
  const [createAssigneeSuggestions, setCreateAssigneeSuggestions] = useState<UserOption[]>([]);
  const [editAssigneeSuggestions, setEditAssigneeSuggestions] = useState<UserOption[]>([]);

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const response = await projects.get(id!);
      setProject(response.data);
      setUserOptions(response.data.assignable_users || []);
      setError(null);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to load project'));
    } finally {
      setLoading(false);
    }
  };

  const mergeUserOptions = (incomingUsers: UserOption[]) => {
    if (incomingUsers.length === 0) {
      return;
    }

    setUserOptions((current: UserOption[]) => {
      const byId = new Map(current.map((userOption: UserOption) => [userOption.id, userOption]));
      incomingUsers.forEach((userOption: UserOption) => byId.set(userOption.id, userOption));
      return Array.from(byId.values());
    });
  };

  const searchAssignableUsers = async (
    query: string,
    setSuggestions: React.Dispatch<React.SetStateAction<UserOption[]>>
  ) => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await users.search(normalizedQuery, 8);
      const foundUsers: UserOption[] = response.data.users || [];
      setSuggestions(foundUsers);
      mergeUserOptions(foundUsers);
    } catch {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    if (!isCreateAssigneeMenuOpen) {
      return;
    }

    const timer = setTimeout(() => {
      searchAssignableUsers(formData.assignee_name, setCreateAssigneeSuggestions);
    }, 250);

    return () => clearTimeout(timer);
  }, [formData.assignee_name, isCreateAssigneeMenuOpen]);

  useEffect(() => {
    if (!isEditAssigneeMenuOpen) {
      return;
    }

    const timer = setTimeout(() => {
      searchAssignableUsers(editFormData.assignee_name, setEditAssigneeSuggestions);
    }, 250);

    return () => clearTimeout(timer);
  }, [editFormData.assignee_name, isEditAssigneeMenuOpen]);

  const usersById = userOptions.reduce<Record<string, UserOption>>((lookup: Record<string, UserOption>, userOption: UserOption) => {
    lookup[userOption.id] = userOption;
    return lookup;
  }, {});

  const usersByIdentity = [...userOptions, ...createAssigneeSuggestions, ...editAssigneeSuggestions].reduce<Record<string, UserOption>>(
    (lookup: Record<string, UserOption>, userOption: UserOption) => {
      lookup[userOption.name.toLowerCase()] = userOption;
      lookup[userOption.email.toLowerCase()] = userOption;
      return lookup;
    },
    {}
  );

  const resolveAssigneeId = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    return usersByIdentity[trimmedValue.toLowerCase()]?.id || null;
  };

  const getMatchingUsers = (query: string, suggestions: UserOption[]) => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return [] as UserOption[];
    }

    if (suggestions.length > 0) {
      return suggestions.slice(0, 8);
    }

    return userOptions
      .filter((userOption: UserOption) =>
        userOption.name.toLowerCase().includes(normalizedQuery) ||
        userOption.email.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 8);
  };

  const upsertTaskInProject = (updatedTask: Task) => {
    setProject((currentProject: Project | null) => {
      if (!currentProject) {
        return currentProject;
      }

      const existingTaskIndex = currentProject.tasks.findIndex((task: Task) => task.id === updatedTask.id);

      if (existingTaskIndex === -1) {
        return {
          ...currentProject,
          tasks: [updatedTask, ...currentProject.tasks],
        };
      }

      return {
        ...currentProject,
        tasks: currentProject.tasks.map((task: Task) => (task.id === updatedTask.id ? updatedTask : task)),
      };
    });
  };

  const removeTaskFromProject = (taskId: string) => {
    setProject((currentProject: Project | null) => {
      if (!currentProject) {
        return currentProject;
      }

      return {
        ...currentProject,
        tasks: currentProject.tasks.filter((task: Task) => task.id !== taskId),
      };
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const assigneeId = resolveAssigneeId(formData.assignee_name);

      if (formData.assignee_name.trim() && !assigneeId) {
        setError('Assignee must match an existing user name or email.');
        return;
      }

      const response = await tasks.create(
        id!,
        formData.title,
        formData.description,
        formData.priority,
        assigneeId || undefined,
        formData.due_date || undefined,
      );
      const createdTask = response.data as Task;

      upsertTaskInProject(createdTask);

      setFormData({ title: '', description: '', priority: 'medium', assignee_name: '', due_date: '' });
      setShowTaskForm(false);
      setIsCreateAssigneeMenuOpen(false);
      setCreateAssigneeSuggestions([]);
      setError(null);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to create task'));
    }
  };

  const selectAssignee = (name: string, setter: (data: any) => void, closeMenu: (open: boolean) => void) => {
    setter((current: any) => ({ ...current, assignee_name: name }));
    closeMenu(false);
    setCreateAssigneeSuggestions([]);
    setEditAssigneeSuggestions([]);
  };

  const openEditModal = (task: Task) => {
    const assigneeName = task.assignee_id
      ? usersById[task.assignee_id]?.name || ''
      : '';
    setEditingTask(task);
    setEditFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      assignee_name: assigneeName,
      due_date: task.due_date || '',
      status: task.status,
    });
    setIsEditAssigneeMenuOpen(false);
    setEditAssigneeSuggestions([]);
  };

  const openTaskDetails = (taskId: string) => {
    navigate(`/projects/${id}/tasks/${taskId}`);
  };

  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      const assigneeId = resolveAssigneeId(editFormData.assignee_name);

      if (editFormData.assignee_name.trim() && !assigneeId) {
        setError('Assignee must match an existing user name or email.');
        return;
      }

      const updates: Record<string, string | null> = {};

      if (editFormData.title !== editingTask.title) {
        updates.title = editFormData.title;
      }
      if (editFormData.description !== (editingTask.description || '')) {
        updates.description = editFormData.description || null;
      }
      if (editFormData.priority !== editingTask.priority) {
        updates.priority = editFormData.priority;
      }
      if ((assigneeId || null) !== editingTask.assignee_id) {
        updates.assignee_id = assigneeId || null;
      }
      if ((editFormData.due_date || null) !== editingTask.due_date) {
        updates.due_date = editFormData.due_date || null;
      }
      if (editFormData.status !== editingTask.status) {
        updates.status = editFormData.status;
      }

      if (Object.keys(updates).length === 0) {
        setEditingTask(null);
        setIsEditAssigneeMenuOpen(false);
        return;
      }

      const response = await tasks.update(editingTask.id, updates);
      const updatedTask = response.data as Task;

      upsertTaskInProject(updatedTask);

      setEditingTask(null);
      setIsEditAssigneeMenuOpen(false);
      setEditAssigneeSuggestions([]);
      setError(null);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to update task'));
    }
  };

  const closeEditModal = () => {
    setEditingTask(null);
    setIsEditAssigneeMenuOpen(false);
    setEditAssigneeSuggestions([]);
  };

  const toggleStatusFilter = (status: 'todo' | 'in_progress' | 'done') => {
    setSelectedStatusFilter(selectedStatusFilter === status ? null : status);
  };

  const formatDate = (value: string | null) => {
    if (!value) {
      return 'Not set';
    }

    return new Date(value).toLocaleDateString();
  };

  const getAssigneeLabel = (assigneeId: string | null) => {
    if (!assigneeId) {
      return 'Unassigned';
    }

    const match = usersById[assigneeId];
    return match ? match.name : 'Assigned';
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const response = await tasks.update(taskId, { status: newStatus });
      upsertTaskInProject(response.data as Task);
      setError(null);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to update task'));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await tasks.delete(taskId);
      removeTaskFromProject(taskId);
      setError(null);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to delete task'));
    }
  };

  if (loading) return <div className="p-8 text-center">Loading project...</div>;
  if (!project) return <div className="p-8 text-center">Project not found</div>;

  const taskSummary = project.tasks.reduce<{
    filteredTasks: Task[];
    statusCounts: {
      todo: number;
      in_progress: number;
      done: number;
    };
  }>(
    (summary: {
      filteredTasks: Task[];
      statusCounts: {
        todo: number;
        in_progress: number;
        done: number;
      };
    }, task: Task) => {
      summary.statusCounts[task.status] += 1;

      if (!selectedStatusFilter || task.status === selectedStatusFilter) {
        summary.filteredTasks.push(task);
      }

      return summary;
    },
    {
      filteredTasks: [] as Task[],
      statusCounts: {
        todo: 0,
        in_progress: 0,
        done: 0,
      },
    }
  );

  const { filteredTasks, statusCounts } = taskSummary;

  const createMatchingUsers = getMatchingUsers(formData.assignee_name, createAssigneeSuggestions);
  const editMatchingUsers = getMatchingUsers(editFormData.assignee_name, editAssigneeSuggestions);

  const getStatusLabel = (status: string) => {
    return status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <Button onClick={() => navigate('/projects')} variant="ghost" className="mb-2 px-0">
            ← Back to Projects
          </Button>
          <h1 className="text-4xl font-semibold tracking-tight">{project.name}</h1>
          {project.description && <p className="text-slate-600 mt-2">{project.description}</p>}
        </div>
        <Button
          onClick={() => setShowTaskForm(true)}
          size="lg"
        >
          New Task
        </Button>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>}

      {showTaskForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create Task</CardTitle>
            <CardDescription>Add a new task to this project board.</CardDescription>
          </CardHeader>
          <CardContent>
          <form onSubmit={handleCreateTask} className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <Input
                type="text"
                placeholder="Task title"
                value={formData.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((current: TaskFormData) => ({ ...current, title: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <Textarea
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData((current: TaskFormData) => ({ ...current, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData((current: TaskFormData) => ({ ...current, priority: e.target.value as TaskFormData['priority'] }))}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Assignee</label>
                <div className="flex gap-2">
                  <Input
                    value={formData.assignee_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setFormData((current: TaskFormData) => ({ ...current, assignee_name: e.target.value }));
                      setIsCreateAssigneeMenuOpen(true);
                    }}
                    onFocus={() => setIsCreateAssigneeMenuOpen(true)}
                    onBlur={() => setTimeout(() => setIsCreateAssigneeMenuOpen(false), 120)}
                    placeholder="Type a name"
                    list="taskflow-assignee-options"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFormData((current: TaskFormData) => ({ ...current, assignee_name: '' }));
                      setIsCreateAssigneeMenuOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>
                {isCreateAssigneeMenuOpen && formData.assignee_name.trim() && (
                  <div className="rounded-md border border-slate-300 bg-white shadow-md max-h-40 overflow-y-auto">
                    {createMatchingUsers.length > 0
                      ? createMatchingUsers.map((userOption: UserOption, index: number) => (
                          <button
                            key={userOption.id}
                            type="button"
                            onMouseDown={(e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault()}
                            onClick={() => selectAssignee(userOption.name, setFormData, setIsCreateAssigneeMenuOpen)}
                            className={`w-full text-left px-3 py-2 text-sm transition ${
                              formData.assignee_name === userOption.name ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                            } ${
                              index !== createMatchingUsers.length - 1 ? 'border-b border-slate-200' : ''
                            }`}
                          >
                            <div className="font-medium">{userOption.name}</div>
                            <div className="text-xs text-slate-500">{userOption.email}</div>
                          </button>
                        ))
                      : <div className="px-3 py-2 text-xs text-slate-500">No matching users</div>}
                  </div>
                )}
                <p className="text-xs text-slate-500">Optional. Start typing to select user.</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Due Date</label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((current: TaskFormData) => ({ ...current, due_date: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button type="button" variant="secondary" onClick={() => setShowTaskForm(false)}>Cancel</Button>
            </div>
          </form>
          </CardContent>
        </Card>
      )}

      {/* Filter buttons */}
      <div className="mb-6 flex gap-2">
        {(['todo', 'in_progress', 'done'] as const).map(status => (
          <Button
            key={status}
            onClick={() => toggleStatusFilter(status)}
            variant={selectedStatusFilter === status ? 'default' : 'outline'}
            className={`${selectedStatusFilter === status ? 'ring-2 ring-slate-400' : ''}`}
          >
            {getStatusLabel(status)} ({statusCounts[status]})
          </Button>
        ))}
        {selectedStatusFilter && (
          <Button
            onClick={() => setSelectedStatusFilter(null)}
            variant="ghost"
            className="text-slate-500"
          >
            Clear Filter
          </Button>
        )}
      </div>

      <Card className="bg-slate-50/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Tasks</CardTitle>
          <CardDescription>
            {selectedStatusFilter ? `${getStatusLabel(selectedStatusFilter)} tasks` : 'All tasks'} ({filteredTasks.length})
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {filteredTasks.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No tasks found</p>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task: Task) => (
                <div
                  key={task.id}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                  onClick={() => openTaskDetails(task.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{task.title}</p>
                      {task.description && <p className="text-xs text-slate-600 mt-1">{task.description}</p>}
                    </div>
                    <Button
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        openEditModal(task);
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-slate-600 hover:text-slate-900"
                    >
                      ✎ Edit
                    </Button>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <p>Created: {formatDate(task.created_at)}</p>
                    <p>Updated: {formatDate(task.updated_at)}</p>
                    <p>Due: {formatDate(task.due_date)}</p>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`${
                        task.priority === 'high' ? 'bg-red-100 text-red-700' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {task.priority}
                      </Badge>
                      <Badge className="bg-slate-100 text-slate-700">{getStatusLabel(task.status)}</Badge>
                      <Badge className="bg-slate-100 text-slate-700">{getAssigneeLabel(task.assignee_id)}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <select
                        value={task.status}
                        onClick={(e: React.MouseEvent<HTMLSelectElement>) => e.stopPropagation()}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleUpdateTaskStatus(task.id, e.target.value)}
                        className="h-8 text-xs border border-slate-300 rounded px-2 bg-white text-slate-700"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                      <Button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-red-600 hover:text-red-700"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Edit Task</CardTitle>
              <CardDescription>Update task details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEditTask} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Title</label>
                  <Input
                    type="text"
                    placeholder="Task title"
                    value={editFormData.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData((current: EditFormData) => ({ ...current, title: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Description</label>
                  <Textarea
                    placeholder="Description (optional)"
                    value={editFormData.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditFormData((current: EditFormData) => ({ ...current, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Priority</label>
                    <select
                      value={editFormData.priority}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditFormData((current: EditFormData) => ({ ...current, priority: e.target.value as EditFormData['priority'] }))}
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditFormData((current: EditFormData) => ({ ...current, status: e.target.value as EditFormData['status'] }))}
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Assignee</label>
                  <div className="flex gap-2">
                    <Input
                      value={editFormData.assignee_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setEditFormData((current: EditFormData) => ({ ...current, assignee_name: e.target.value }));
                        setIsEditAssigneeMenuOpen(true);
                      }}
                      onFocus={() => setIsEditAssigneeMenuOpen(true)}
                      onBlur={() => setTimeout(() => setIsEditAssigneeMenuOpen(false), 120)}
                      placeholder="Type a name"
                      list="taskflow-assignee-options"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditFormData((current: EditFormData) => ({ ...current, assignee_name: '' }));
                        setIsEditAssigneeMenuOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                  {isEditAssigneeMenuOpen && editFormData.assignee_name.trim() && (
                    <div className="rounded-md border border-slate-300 bg-white shadow-md max-h-40 overflow-y-auto">
                      {editMatchingUsers.length > 0
                        ? editMatchingUsers.map((userOption: UserOption, index: number) => (
                            <button
                              key={userOption.id}
                              type="button"
                              onMouseDown={(e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault()}
                              onClick={() => selectAssignee(userOption.name, setEditFormData, setIsEditAssigneeMenuOpen)}
                              className={`w-full text-left px-3 py-2 text-sm transition ${
                                editFormData.assignee_name === userOption.name ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                              } ${
                                index !== editMatchingUsers.length - 1 ? 'border-b border-slate-200' : ''
                              }`}
                            >
                              <div className="font-medium">{userOption.name}</div>
                              <div className="text-xs text-slate-500">{userOption.email}</div>
                            </button>
                          ))
                        : <div className="px-3 py-2 text-xs text-slate-500">No matching users</div>}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">Optional. Start typing to select user.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Due Date</label>
                  <Input
                    type="date"
                    value={editFormData.due_date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFormData((current: EditFormData) => ({ ...current, due_date: e.target.value }))}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit">Save Changes</Button>
                  <Button type="button" variant="secondary" onClick={closeEditModal}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <datalist id="taskflow-assignee-options">
        {userOptions.map((userOption: UserOption) => (
          <option key={userOption.id} value={userOption.name} label={userOption.email} />
        ))}
      </datalist>
    </div>
  );
};
