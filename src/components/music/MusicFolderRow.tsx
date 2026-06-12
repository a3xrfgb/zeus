import { FolderOpen, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";

export function MusicFolderRow({
  id,
  label,
  count,
  active,
  onSelect,
  onRename,
  onRemove,
}: {
  id: string;
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  onRename: (next: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(label);
    setEditing(true);
    queueMicrotask(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commitRename = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== label) onRename(next);
  };

  return (
    <div className="group/folder flex min-w-0 items-center gap-0.5">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setEditing(false);
          }}
          className="min-w-0 flex-1 rounded-md border border-[var(--music-accent)]/40 bg-[var(--music-elevated)] px-2 py-1.5 text-sm text-[var(--music-text)] outline-none"
          aria-label={t("music.renameFolder")}
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition",
            active
              ? "bg-[var(--music-active)] font-medium text-[var(--music-text)]"
              : "text-[var(--music-muted)] hover:bg-[var(--music-hover)] hover:text-[var(--music-text)]",
          )}
          title={id}
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="text-xs tabular-nums opacity-60">{count}</span>
        </button>
      )}

      {!editing ? (
        <div className="flex shrink-0 items-center opacity-0 transition group-hover/folder:opacity-100 group-focus-within/folder:opacity-100">
          <button
            type="button"
            title={t("music.renameFolder")}
            aria-label={t("music.renameFolder")}
            onClick={startRename}
            className="rounded p-1 text-[var(--music-muted)] transition hover:bg-[var(--music-hover)] hover:text-[var(--music-text)]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={t("music.removeFolder")}
            aria-label={t("music.removeFolder")}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded p-1 text-[var(--music-muted)] transition hover:bg-red-500/15 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
