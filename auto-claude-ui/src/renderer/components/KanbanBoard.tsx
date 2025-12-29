import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Plus, Inbox, Loader2, Eye, CheckCircle2, Archive, ChevronDown, ChevronRight, RefreshCw, GitMerge, GitPullRequest } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Input } from './ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { useTaskStore } from '../stores/task-store';
import { TaskCard } from './TaskCard';
import { SortableTaskCard } from './SortableTaskCard';
import { TASK_STATUS_COLUMNS, TASK_STATUS_LABELS } from '../../shared/constants';
import { cn } from '../lib/utils';
import { persistTaskStatus, archiveTasks, loadTasks } from '../stores/task-store';
import type { Task, TaskStatus } from '../../shared/types';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onNewTaskClick?: () => void;
}

interface DroppableColumnProps {
  status: TaskStatus;
  tasks: Task[];
  allTasks: Task[]; // All tasks for finding children
  onTaskClick: (task: Task) => void;
  isOver: boolean;
  onAddClick?: () => void;
  onArchiveAll?: () => void;
  expandedTasks: Set<string>;
  onToggleExpand: (taskId: string) => void;
}

// Empty state content for each column
const getEmptyStateContent = (status: TaskStatus): { icon: React.ReactNode; message: string; subtext?: string } => {
  switch (status) {
    case 'backlog':
      return {
        icon: <Inbox className="h-6 w-6 text-muted-foreground/50" />,
        message: 'No tasks planned',
        subtext: 'Add a task to get started'
      };
    case 'in_progress':
      return {
        icon: <Loader2 className="h-6 w-6 text-muted-foreground/50" />,
        message: 'Nothing running',
        subtext: 'Start a task from Planning'
      };
    case 'ai_review':
      return {
        icon: <Eye className="h-6 w-6 text-muted-foreground/50" />,
        message: 'No tasks in review',
        subtext: 'AI will review completed tasks'
      };
    case 'human_review':
      return {
        icon: <Eye className="h-6 w-6 text-muted-foreground/50" />,
        message: 'Nothing to review',
        subtext: 'Tasks await your approval here'
      };
    case 'done':
      return {
        icon: <CheckCircle2 className="h-6 w-6 text-muted-foreground/50" />,
        message: 'No completed tasks',
        subtext: 'Approved tasks appear here'
      };
    default:
      return {
        icon: <Inbox className="h-6 w-6 text-muted-foreground/50" />,
        message: 'No tasks'
      };
  }
};

function DroppableColumn({ status, tasks, allTasks, onTaskClick, isOver, onAddClick, onArchiveAll, expandedTasks, onToggleExpand }: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status
  });

  // Show ALL tasks in their status columns (including children)
  // This allows child tasks to be moved independently
  const taskIds = tasks.map((t) => t.id);

  // Helper to get children of a task
  const getChildren = (parentId: string): Task[] => {
    return allTasks.filter((t) => t.parentTaskId === parentId);
  };

  // Helper to render a task and its children recursively
  const renderTaskWithChildren = (task: Task, depth: number = 0): React.ReactElement[] => {
    const isExpanded = expandedTasks.has(task.id);
    const children = getChildren(task.id);
    const hasChildren = children.length > 0;

    const elements: React.ReactElement[] = [
      <div key={task.id} className="w-full" style={{ paddingLeft: depth > 0 ? `${depth * 16}px` : 0 }}>
        <div className="flex items-start gap-1 w-full">
          {/* Expand/collapse button for parent tasks */}
          {hasChildren && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 mt-3 shrink-0 hover:bg-primary/10 rounded-sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(task.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          )}
          <div className="flex-1 min-w-0 overflow-hidden">
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              allTasks={allTasks}
            />
          </div>
        </div>
      </div>
    ];

    // Render children if expanded
    if (hasChildren && isExpanded) {
      children.forEach((child) => {
        elements.push(...renderTaskWithChildren(child, depth + 1));
      });
    }

    return elements;
  };

  const getColumnBorderColor = (): string => {
    switch (status) {
      case 'backlog':
        return 'column-backlog';
      case 'in_progress':
        return 'column-in-progress';
      case 'ai_review':
        return 'column-ai-review';
      case 'human_review':
        return 'column-human-review';
      case 'done':
        return 'column-done';
      default:
        return 'border-t-muted-foreground/30';
    }
  };

  const emptyState = getEmptyStateContent(status);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border border-white/5 bg-linear-to-b from-secondary/30 to-transparent backdrop-blur-sm transition-all duration-200',
        getColumnBorderColor(),
        'border-t-2',
        isOver && 'drop-zone-highlight'
      )}
    >
      {/* Column header - enhanced styling */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-semibold text-sm text-foreground">
            {TASK_STATUS_LABELS[status]}
          </h2>
          <span className="column-count-badge">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {status === 'backlog' && onAddClick && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={onAddClick}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {status === 'done' && onArchiveAll && tasks.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-muted-foreground/10 hover:text-muted-foreground transition-colors"
              onClick={onArchiveAll}
              title="Archive all done tasks"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full px-3 pb-3 pt-2">
          <SortableContext
            items={taskIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3 min-h-[120px]">
              {tasks.length === 0 ? (
                <div
                  className={cn(
                    'empty-column-dropzone flex flex-col items-center justify-center py-6',
                    isOver && 'active'
                  )}
                >
                  {isOver ? (
                    <>
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                        <Plus className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-primary">Drop here</span>
                    </>
                  ) : (
                    <>
                      {emptyState.icon}
                      <span className="mt-2 text-sm font-medium text-muted-foreground/70">
                        {emptyState.message}
                      </span>
                      {emptyState.subtext && (
                        <span className="mt-0.5 text-xs text-muted-foreground/50">
                          {emptyState.subtext}
                        </span>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* Render ALL tasks in their status column - each task is independently draggable */
                tasks.map((task) => {
                  const isChildTask = !!task.parentTaskId;
                  const hasChildren = getChildren(task.id).length > 0;
                  const isExpanded = expandedTasks.has(task.id);

                  return (
                    <div key={task.id} className="w-full">
                      <div className="flex items-start gap-1 w-full">
                        {/* Expand/collapse button for parent tasks */}
                        {hasChildren && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 mt-3 shrink-0 hover:bg-primary/10 rounded-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleExpand(task.id);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        )}
                        {/* Visual indent for child tasks */}
                        {isChildTask && !hasChildren && (
                          <div className="w-4 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <SortableTaskCard
                            task={task}
                            onClick={() => onTaskClick(task)}
                            allTasks={allTasks}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}

export function KanbanBoard({ tasks, onTaskClick, onNewTaskClick }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Merge confirmation dialog state
  const [mergeDialog, setMergeDialog] = useState<{
    open: boolean;
    taskId: string | null;
    taskTitle: string;
    specId: string | null;
    branchName: string;
    isMerging: boolean;
    error: string | null;
  }>({ open: false, taskId: null, taskTitle: '', specId: null, branchName: '', isMerging: false, error: null });
  const updateTaskStatus = useTaskStore((state) => state.updateTaskStatus);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    // Initialize with all parent tasks expanded by default
    const initialExpanded = new Set<string>();
    tasks.forEach(task => {
      if (task.hasChildren && task.childTaskIds && task.childTaskIds.length > 0) {
        initialExpanded.add(task.id);
      }
    });
    return initialExpanded;
  });

  const handleToggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Get project ID from first task for refresh
  const projectId = tasks[0]?.projectId;

  // Refresh tasks handler
  const handleRefresh = useCallback(async () => {
    if (!projectId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadTasks(projectId);
    } finally {
      setIsRefreshing(false);
    }
  }, [projectId, isRefreshing]);

  // Keyboard shortcut for refresh (R key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // R key for refresh (without modifiers)
      if (e.key.toUpperCase() === 'R' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRefresh]);

  // Auto-expand new parent tasks when they appear
  useEffect(() => {
    // Collect all parent task IDs that should be expanded
    const parentTaskIds = tasks
      .filter(task => task.hasChildren && task.childTaskIds && task.childTaskIds.length > 0)
      .map(task => task.id);

    // Only update state if there are new parent tasks to expand
    setExpandedTasks(prev => {
      const newIds = parentTaskIds.filter(id => !prev.has(id));
      if (newIds.length === 0) {
        return prev; // No change needed - return same reference to prevent re-render
      }
      const next = new Set(prev);
      newIds.forEach(id => next.add(id));
      return next;
    });
  }, [tasks]);

  // Count archived tasks for display
  const archivedCount = useMemo(() => {
    return tasks.filter((t) => t.metadata?.archivedAt).length;
  }, [tasks]);

  // Filter tasks based on archive status
  const filteredTasks = useMemo(() => {
    if (showArchived) {
      return tasks; // Show all tasks including archived
    }
    return tasks.filter((t) => !t.metadata?.archivedAt);
  }, [tasks, showArchived]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // 8px movement required before drag starts
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: [],
      in_progress: [],
      ai_review: [],
      human_review: [],
      done: []
    };

    filteredTasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    return grouped;
  }, [filteredTasks]);

  const handleArchiveAll = async () => {
    // Get projectId from the first task (all tasks should have the same projectId)
    const projectId = tasks[0]?.projectId;
    if (!projectId) {
      console.error('No projectId found');
      return;
    }

    const doneTaskIds = tasksByStatus.done.map((t) => t.id);
    if (doneTaskIds.length === 0) return;

    await archiveTasks(projectId, doneTaskIds);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;

    if (!over) {
      setOverColumnId(null);
      return;
    }

    const overId = over.id as string;

    // Check if over a column
    if (TASK_STATUS_COLUMNS.includes(overId as TaskStatus)) {
      setOverColumnId(overId);
      return;
    }

    // Check if over a task - get its column
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      setOverColumnId(overTask.status);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumnId(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;
    const task = tasks.find((t) => t.id === activeTaskId);

    if (!task) return;

    // Helper to check if task is a parent task
    const isParentTask = task.hasChildren || (task.childTaskIds && task.childTaskIds.length > 0);

    // Helper function to handle status update with merge dialog for done status
    const updateStatus = async (taskId: string, newStatus: TaskStatus, taskTitle: string, fromStatus: TaskStatus, specId: string) => {
      // If moving to done from human_review, show merge dialog instead of direct update
      if (newStatus === 'done' && fromStatus === 'human_review') {
        // Generate a default branch name from the spec ID
        const defaultBranchName = `feature/${specId}`;
        setMergeDialog({
          open: true,
          taskId,
          taskTitle,
          specId,
          branchName: defaultBranchName,
          isMerging: false,
          error: null
        });
        return;
      }

      await persistTaskStatus(taskId, newStatus);
    };

    // Check if dropped on a column
    if (TASK_STATUS_COLUMNS.includes(overId as TaskStatus)) {
      const newStatus = overId as TaskStatus;

      if (task.status !== newStatus) {
        // Prevent parent tasks from being dragged to in_progress
        if (isParentTask && newStatus === 'in_progress') {
          // Silently ignore - the visual feedback shows it's a parent task
          // Users should start child tasks instead
          console.log('[KanbanBoard] Blocked: Cannot drag parent task to in_progress. Start child tasks instead.');
          return;
        }

        // Persist status change - show merge dialog if moving to done from human_review
        await updateStatus(activeTaskId, newStatus, task.title, task.status, task.specId);
      }
      return;
    }

    // Check if dropped on another task - move to that task's column
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      if (task.status !== overTask.status) {
        // Prevent parent tasks from being dragged to in_progress
        if (isParentTask && overTask.status === 'in_progress') {
          console.log('[KanbanBoard] Blocked: Cannot drag parent task to in_progress column. Start child tasks instead.');
          return;
        }

        // Persist status change - show merge dialog if moving to done from human_review
        await updateStatus(activeTaskId, overTask.status, task.title, task.status, task.specId);
      }
    }
  };

  // Handle merge and complete - creates a new branch to merge into (safe)
  const handleMergeAndComplete = async () => {
    if (!mergeDialog.taskId || !mergeDialog.branchName.trim()) return;

    setMergeDialog(prev => ({ ...prev, isMerging: true, error: null }));

    try {
      // Call the merge worktree API with createBranch option
      // This creates a new branch and merges into it, keeping current branch safe
      const result = await window.electronAPI.mergeWorktree(mergeDialog.taskId, {
        createBranch: mergeDialog.branchName.trim()
      });

      if (result.success) {
        // Update local state to done
        updateTaskStatus(mergeDialog.taskId, 'done');
        setMergeDialog({ open: false, taskId: null, taskTitle: '', specId: null, branchName: '', isMerging: false, error: null });
      } else {
        setMergeDialog(prev => ({
          ...prev,
          isMerging: false,
          error: result.error || 'Failed to merge worktree changes'
        }));
      }
    } catch (err) {
      setMergeDialog(prev => ({
        ...prev,
        isMerging: false,
        error: err instanceof Error ? err.message : 'An error occurred while merging'
      }));
    }
  };

  // Handle skip merge (force complete without merging)
  const handleSkipMerge = async () => {
    if (!mergeDialog.taskId) return;

    setMergeDialog(prev => ({ ...prev, isMerging: true, error: null }));

    try {
      // Force complete - this will clean up the worktree without merging
      const success = await persistTaskStatus(mergeDialog.taskId, 'done', { force: true });
      if (success) {
        setMergeDialog({ open: false, taskId: null, taskTitle: '', specId: null, branchName: '', isMerging: false, error: null });
      } else {
        setMergeDialog(prev => ({
          ...prev,
          isMerging: false,
          error: 'Failed to complete task'
        }));
      }
    } catch (err) {
      setMergeDialog(prev => ({
        ...prev,
        isMerging: false,
        error: err instanceof Error ? err.message : 'An error occurred'
      }));
    }
  };

  // Handle create PR from worktree
  const handleCreatePR = async () => {
    if (!mergeDialog.taskId || !mergeDialog.specId) return;

    setMergeDialog(prev => ({ ...prev, isMerging: true, error: null }));

    try {
      // Call the backend to push and create PR
      const result = await window.electronAPI.createWorktreePR(mergeDialog.taskId, {
        title: mergeDialog.taskTitle
      });

      if (result.success && result.data?.success) {
        // PR created successfully - open it in browser
        if (result.data.prUrl) {
          window.electronAPI.openExternal(result.data.prUrl);
        }
        // Keep task in human_review since PR needs to be merged on GitHub
        setMergeDialog({ open: false, taskId: null, taskTitle: '', specId: null, branchName: '', isMerging: false, error: null });
      } else {
        setMergeDialog(prev => ({
          ...prev,
          isMerging: false,
          error: result.error || result.data?.message || 'Failed to create pull request'
        }));
      }
    } catch (err) {
      setMergeDialog(prev => ({
        ...prev,
        isMerging: false,
        error: err instanceof Error ? err.message : 'An error occurred'
      }));
    }
  };

  return (
    <TooltipProvider>
    <div className="flex h-full flex-col">
      {/* Kanban header with filters */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
        {/* Left side - Refresh button */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || !projectId}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                Refresh
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded-md border border-border bg-secondary px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                  R
                </kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh tasks (R)</TooltipContent>
          </Tooltip>
        </div>

        {/* Right side - Show archived */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="showArchived"
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked === true)}
          />
          <Label
            htmlFor="showArchived"
            className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer"
          >
            <Archive className="h-3.5 w-3.5" />
            Show archived
            {archivedCount > 0 && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-muted">
                {archivedCount}
              </span>
            )}
          </Label>
        </div>
      </div>

      {/* Kanban columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {TASK_STATUS_COLUMNS.map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              allTasks={filteredTasks}
              onTaskClick={onTaskClick}
              isOver={overColumnId === status}
              onAddClick={status === 'backlog' ? onNewTaskClick : undefined}
              onArchiveAll={status === 'done' ? handleArchiveAll : undefined}
              expandedTasks={expandedTasks}
              onToggleExpand={handleToggleExpand}
            />
          ))}
        </div>

        {/* Drag overlay - enhanced visual feedback */}
        <DragOverlay>
          {activeTask ? (
            <div className="drag-overlay-card">
              <TaskCard task={activeTask} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Merge and complete confirmation dialog */}
      <AlertDialog
        open={mergeDialog.open}
        onOpenChange={(open) => !open && !mergeDialog.isMerging && setMergeDialog({ open: false, taskId: null, taskTitle: '', specId: null, branchName: '', isMerging: false, error: null })}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-primary" />
              Complete Task
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left space-y-3">
                <p>
                  The task <strong>"{mergeDialog.taskTitle}"</strong> has changes in an isolated workspace.
                </p>

                {/* Branch name input */}
                <div className="space-y-2">
                  <Label htmlFor="branch-name" className="text-sm font-medium">
                    New branch name (changes will be merged here):
                  </Label>
                  <Input
                    id="branch-name"
                    value={mergeDialog.branchName}
                    onChange={(e) => setMergeDialog(prev => ({ ...prev, branchName: e.target.value }))}
                    placeholder="feature/my-changes"
                    disabled={mergeDialog.isMerging}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your current branch will remain untouched. Changes are merged into this new branch.
                  </p>
                </div>

                <ul className="space-y-2 text-sm border-t pt-3">
                  <li className="flex items-start gap-2">
                    <GitMerge className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <span><strong>Merge to Branch</strong> - Creates new branch and merges changes (safe)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <GitPullRequest className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                    <span><strong>Create PR</strong> - Push worktree branch to GitHub and open PR</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Archive className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span><strong>Discard</strong> - Delete worktree without keeping changes</span>
                  </li>
                </ul>
                {mergeDialog.error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm whitespace-pre-wrap font-mono text-xs">
                    {mergeDialog.error}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={mergeDialog.isMerging}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleSkipMerge}
              disabled={mergeDialog.isMerging}
              className="text-muted-foreground"
            >
              Discard
            </Button>
            <Button
              variant="outline"
              onClick={handleCreatePR}
              disabled={mergeDialog.isMerging}
              className="text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
            >
              {mergeDialog.isMerging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <GitPullRequest className="h-4 w-4 mr-2" />
                  Create PR
                </>
              )}
            </Button>
            <AlertDialogAction
              onClick={handleMergeAndComplete}
              disabled={mergeDialog.isMerging || !mergeDialog.branchName.trim()}
              className="bg-primary"
            >
              {mergeDialog.isMerging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge className="h-4 w-4 mr-2" />
                  Merge to Branch
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
