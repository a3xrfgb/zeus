import * as ContextMenu from "@radix-ui/react-context-menu";
import { Copy, TextSelect } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import {
  sidebarGlassMenuContent,
  sidebarGlassMenuItem,
  sidebarGlassMenuSeparator,
} from "../../lib/sidebarGlassMenu";
import { copyStudySelection, getStudySelectionText, selectAllInStudyRoot } from "./studySelection";
import { StudyZoomProvider } from "./studyZoom";

/** Wraps an open study document so text can be selected and copied (incl. web dev). */
export function StudyDocumentShell({ children }: { children: ReactNode }) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <StudyZoomProvider className={cn("study-document-root h-full min-h-0 select-text")}>
          {children}
        </StudyZoomProvider>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={cn(sidebarGlassMenuContent, "min-w-[9rem]")}>
          <ContextMenu.Item
            className={sidebarGlassMenuItem}
            onSelect={() => {
              if (!getStudySelectionText()) return;
              void copyStudySelection();
            }}
          >
            <Copy className="h-3.5 w-3.5 shrink-0 opacity-85" />
            Copy
          </ContextMenu.Item>
          <ContextMenu.Separator className={sidebarGlassMenuSeparator} />
          <ContextMenu.Item
            className={sidebarGlassMenuItem}
            onSelect={() => selectAllInStudyRoot()}
          >
            <TextSelect className="h-3.5 w-3.5 shrink-0 opacity-85" />
            Select all
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
