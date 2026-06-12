import * as ContextMenu from "@radix-ui/react-context-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  FolderInput,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { useState, type DragEvent } from "react";
import type { Thread } from "../../types/chat";
import { cn } from "../../lib/utils";
import {
  sidebarGlassMenuContent,
  sidebarGlassMenuItem,
  sidebarGlassMenuSeparator,
  sidebarGlassMenuSubContent,
} from "../../lib/sidebarGlassMenu";
import { writeThreadIdsToDataTransfer } from "../../lib/threadDrag";
import { useChatStore } from "../../store/chatStore";
import { useUiStore } from "../../store/uiStore";
import { ProjectColorFolderIcon } from "../projects/ProjectColorFolderIcon";

const menuIcon = "h-3.5 w-3.5 shrink-0 opacity-85";

export function ChatSidebarRow({
  thread: t,
  active,
  collapsed,
  onSelect,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  dragIdsForThread,
  onThreadDragStart,
  onThreadDragEnd,
  showProjectDropHint = false,
}: {
  thread: Thread;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  dragIdsForThread: (threadId: string) => string[];
  onThreadDragStart?: () => void;
  onThreadDragEnd?: () => void;
  showProjectDropHint?: boolean;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const loadProjects = useChatStore((s) => s.loadProjects);
  const projects = useChatStore((s) => s.projects);
  const toggleThreadPin = useChatStore((s) => s.toggleThreadPin);
  const renameThread = useChatStore((s) => s.renameThread);
  const deleteThread = useChatStore((s) => s.deleteThread);
  const assignThreadProject = useChatStore((s) => s.assignThreadProject);
  const createProject = useChatStore((s) => s.createProject);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(t.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const pinned = Boolean(t.pinned);
  const accentColor = t.color?.trim() || "#64748b";

  const openRename = () => {
    setMenuOpen(false);
    setRenameValue(t.title);
    setRenameOpen(true);
  };

  const submitRename = async () => {
    const next = renameValue.trim();
    if (!next) {
      pushToast("Title cannot be empty", "error");
      return;
    }
    try {
      await renameThread(t.id, next);
      setRenameOpen(false);
      pushToast("Chat renamed", "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const openDeleteDialog = () => {
    setMenuOpen(false);
    window.setTimeout(() => setDeleteOpen(true), 0);
  };

  const confirmDelete = async () => {
    try {
      await deleteThread(t.id);
      setDeleteOpen(false);
      pushToast("Chat deleted", "info");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const onToggleStar = async () => {
    try {
      await toggleThreadPin(t.id);
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const onAssignProject = async (projectId: string | null) => {
    try {
      await assignThreadProject(t.id, projectId);
      pushToast(projectId ? "Added to project" : "Removed from project", "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const onNewProject = async () => {
    const name = window.prompt("Project name");
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      pushToast("Project name required", "error");
      return;
    }
    try {
      const p = await createProject(trimmed, {});
      await assignThreadProject(t.id, p.id);
      pushToast("Project created and chat assigned", "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const bulkSelected = selectionMode && selected;
  /** Active chat or checked in bulk-select — use selection bg + light text on the whole row. */
  const highlighted = active || bulkSelected;
  const canDragToProject = showProjectDropHint && !collapsed;

  const beginThreadDrag = (e: DragEvent) => {
    if (!canDragToProject) return;
    const ids = dragIdsForThread(t.id);
    writeThreadIdsToDataTransfer(e.dataTransfer, ids);
    onThreadDragStart?.();
  };

  const endThreadDrag = () => {
    onThreadDragEnd?.();
  };

  if (collapsed) {
    return (
      <button
        type="button"
        title={t.title}
        onClick={onSelect}
        className={cn(
          "flex w-full items-center justify-center rounded-lg px-0 py-2 text-sm transition",
          !highlighted && "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]",
          highlighted &&
            "bg-[var(--selection-bg)] font-medium !text-[var(--selection-fg)] hover:opacity-95",
        )}
      >
        <span className="max-w-[2ch] truncate">{pinned ? "★" : "•"}</span>
      </button>
    );
  }

  return (
    <>
      <ContextMenu.Root
        onOpenChange={(o) => {
          if (o) void loadProjects();
        }}
      >
        <DropdownMenu.Root
          modal={false}
          open={menuOpen}
          onOpenChange={(o) => {
            setMenuOpen(o);
            if (o) void loadProjects();
          }}
        >
          <ContextMenu.Trigger asChild>
            <div
              title={
                canDragToProject
                  ? `${t.title} — drag onto a project`
                  : undefined
              }
              className={cn(
                "group flex w-full items-center gap-0.5 rounded-lg pr-0.5 transition",
                highlighted &&
                  "bg-[var(--selection-bg)] !text-[var(--selection-fg)] [&_button]:!text-[var(--selection-fg)] [&_span]:!text-[var(--selection-fg)]",
              )}
            >
        {selectionMode ? (
          <label
            className="flex shrink-0 cursor-pointer items-center py-2 pl-1"
            onClick={(ev) => ev.stopPropagation()}
            onPointerDown={(ev) => ev.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.()}
              className={cn(
                "h-3.5 w-3.5 rounded accent-[var(--selection-bg)] focus:ring-[var(--selection-bg)] focus:ring-offset-0",
                bulkSelected
                  ? "border-white/80 bg-white/10"
                  : "border-[var(--sidebar-muted)]",
              )}
              aria-label={`Select ${t.title}`}
            />
          </label>
        ) : null}
        <span
          draggable={canDragToProject}
          onDragStart={beginThreadDrag}
          onDragEnd={endThreadDrag}
          title={canDragToProject ? "Drag to a project" : undefined}
          className={cn(
            "my-1.5 w-1 shrink-0 self-stretch rounded-full opacity-90 touch-none",
            canDragToProject && "cursor-grab active:cursor-grabbing",
          )}
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />
        <div
          role="button"
          tabIndex={0}
          draggable={canDragToProject}
          onDragStart={beginThreadDrag}
          onDragEnd={endThreadDrag}
          title={t.title}
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-2 pl-1 pr-1 text-left text-sm transition outline-none",
            canDragToProject && "cursor-grab active:cursor-grabbing",
            highlighted
              ? "font-medium !text-[var(--selection-fg)] hover:bg-white/10"
              : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]",
          )}
        >
          {pinned ? (
            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
          ) : null}
          <span
            className={cn("truncate", highlighted && "!text-[var(--selection-fg)]")}
          >
            {t.title}
          </span>
        </div>

              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  title="Chat options"
                  className={cn(
                    "rounded-md p-1.5 outline-none transition",
                    highlighted
                      ? "!text-[var(--selection-fg)]/90 hover:bg-white/10 hover:!text-[var(--selection-fg)]"
                      : "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]",
                    "opacity-70 group-hover:opacity-100 data-[state=open]:opacity-100",
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" strokeWidth={2} />
                </button>
              </DropdownMenu.Trigger>
            </div>
          </ContextMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={sidebarGlassMenuContent}
              sideOffset={6}
              align="end"
            >
              <DropdownMenu.Item
                className={sidebarGlassMenuItem}
                onSelect={(e) => {
                  e.preventDefault();
                  void onToggleStar();
                }}
              >
                <Star
                  className={cn(menuIcon, pinned && "fill-amber-400 text-amber-500")}
                  strokeWidth={2}
                />
                {pinned ? "Unstar" : "Star"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={sidebarGlassMenuItem}
                onSelect={(e) => {
                  e.preventDefault();
                  openRename();
                }}
              >
                <Pencil className={menuIcon} strokeWidth={2} />
                Rename
              </DropdownMenu.Item>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger
                  className={cn(
                    sidebarGlassMenuItem,
                    "data-[state=open]:bg-[var(--dropdown-hover)]",
                  )}
                >
                  <FolderInput className={menuIcon} strokeWidth={2} />
                  Add to project
                  <span className="ml-auto text-xs opacity-50">›</span>
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent
                    className={sidebarGlassMenuSubContent}
                    sideOffset={6}
                    alignOffset={-4}
                  >
                    <DropdownMenu.Item
                      className={sidebarGlassMenuItem}
                      onSelect={(e) => {
                        e.preventDefault();
                        void onAssignProject(null);
                      }}
                    >
                      No project
                    </DropdownMenu.Item>
                    {projects.map((p) => (
                      <DropdownMenu.Item
                        key={p.id}
                        className={sidebarGlassMenuItem}
                        onSelect={(e) => {
                          e.preventDefault();
                          void onAssignProject(p.id);
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <ProjectColorFolderIcon color={p.color} size={14} />
                          <span className="truncate">{p.name}</span>
                        </span>
                      </DropdownMenu.Item>
                    ))}
                    <DropdownMenu.Separator className={sidebarGlassMenuSeparator} />
                    <DropdownMenu.Item
                      className={sidebarGlassMenuItem}
                      onSelect={(e) => {
                        e.preventDefault();
                        void onNewProject();
                      }}
                    >
                      New project…
                    </DropdownMenu.Item>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
              <DropdownMenu.Separator className={sidebarGlassMenuSeparator} />
              <DropdownMenu.Item
                className={cn(
                  sidebarGlassMenuItem,
                  "text-[var(--dropdown-danger)] data-[highlighted]:text-[var(--dropdown-danger)]",
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  openDeleteDialog();
                }}
              >
                <Trash2 className={menuIcon} strokeWidth={2} />
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <ContextMenu.Portal>
          <ContextMenu.Content className={sidebarGlassMenuContent} alignOffset={-4}>
            <ContextMenu.Item
              className={sidebarGlassMenuItem}
              onSelect={(e) => {
                e.preventDefault();
                void onToggleStar();
              }}
            >
              <Star
                className={cn(menuIcon, pinned && "fill-amber-400 text-amber-500")}
                strokeWidth={2}
              />
              {pinned ? "Unstar" : "Star"}
            </ContextMenu.Item>
            <ContextMenu.Item
              className={sidebarGlassMenuItem}
              onSelect={(e) => {
                e.preventDefault();
                openRename();
              }}
            >
              <Pencil className={menuIcon} strokeWidth={2} />
              Rename
            </ContextMenu.Item>
            <ContextMenu.Sub>
              <ContextMenu.SubTrigger
                className={cn(
                  sidebarGlassMenuItem,
                  "data-[state=open]:bg-[var(--dropdown-hover)]",
                )}
              >
                <FolderInput className={menuIcon} strokeWidth={2} />
                Add to project
                <span className="ml-auto text-xs opacity-50">›</span>
              </ContextMenu.SubTrigger>
              <ContextMenu.Portal>
                <ContextMenu.SubContent className={sidebarGlassMenuSubContent} alignOffset={-4}>
                  <ContextMenu.Item
                    className={sidebarGlassMenuItem}
                    onSelect={(e) => {
                      e.preventDefault();
                      void onAssignProject(null);
                    }}
                  >
                    No project
                  </ContextMenu.Item>
                  {projects.map((p) => (
                    <ContextMenu.Item
                      key={p.id}
                      className={sidebarGlassMenuItem}
                      onSelect={(e) => {
                        e.preventDefault();
                        void onAssignProject(p.id);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <ProjectColorFolderIcon color={p.color} size={14} />
                        <span className="truncate">{p.name}</span>
                      </span>
                    </ContextMenu.Item>
                  ))}
                  <ContextMenu.Separator className={sidebarGlassMenuSeparator} />
                  <ContextMenu.Item
                    className={sidebarGlassMenuItem}
                    onSelect={(e) => {
                      e.preventDefault();
                      void onNewProject();
                    }}
                  >
                    New project…
                  </ContextMenu.Item>
                </ContextMenu.SubContent>
              </ContextMenu.Portal>
            </ContextMenu.Sub>
            <ContextMenu.Separator className={sidebarGlassMenuSeparator} />
            <ContextMenu.Item
              className={cn(
                sidebarGlassMenuItem,
                "text-[var(--dropdown-danger)] data-[highlighted]:text-[var(--dropdown-danger)]",
              )}
              onSelect={(e) => {
                e.preventDefault();
                openDeleteDialog();
              }}
            >
              <Trash2 className={menuIcon} strokeWidth={2} />
              Delete
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[410] bg-black/50 data-[state=open]:animate-in" />
          <Dialog.Content className="zeus-confirm-dialog fixed left-1/2 top-1/2 z-[411] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl">
            <Dialog.Title className="text-sm font-semibold text-[var(--app-text)]">
              Delete chat?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-[var(--app-muted)]">
              Delete &ldquo;{t.title}&rdquo;? This cannot be undone.
            </Dialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm text-[var(--app-muted)] hover:bg-[var(--app-bg)]"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                onClick={() => void confirmDelete()}
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={renameOpen} onOpenChange={setRenameOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[400] bg-black/50 data-[state=open]:animate-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[401] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl">
            <Dialog.Title className="text-sm font-semibold text-[var(--app-text)]">
              Rename chat
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Enter a new title for this conversation.
            </Dialog.Description>
            <input
              className="mt-3 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:border-accent"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitRename();
              }}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm text-[var(--app-muted)] hover:bg-[var(--app-bg)]"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white"
                onClick={() => void submitRename()}
              >
                Save
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
