import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Document } from "@shared/schema";

interface DocumentConflictDialogProps {
  conflict: { serverDocument: Document } | null;
  localTitle: string;
  onTakeServer: () => void;
  onKeepMine: () => void;
}

/**
 * Shown when autosave was refused (409) because a teammate saved the same
 * document first. The writer chooses: adopt the server copy, or force-write
 * their own. Nothing is silently overwritten.
 */
export default function DocumentConflictDialog({
  conflict,
  localTitle,
  onTakeServer,
  onKeepMine,
}: DocumentConflictDialogProps) {
  if (!conflict) return null;
  const server = conflict.serverDocument;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onTakeServer(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>This document changed while you were editing</DialogTitle>
          <DialogDescription>
            A teammate saved “{server.title}” after you opened it. Your copy is safe in this
            window — choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Teammate's version</div>
            <div className="font-medium">{server.title}</div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              {server.content?.length?.toLocaleString() ?? 0} characters · saved {new Date(server.updatedAt).toLocaleTimeString()}
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/40">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Your version</div>
            <div className="font-medium">{localTitle}</div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              Unsaved in this window
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onKeepMine}>
            Keep mine (overwrite theirs)
          </Button>
          <Button onClick={onTakeServer}>
            Take teammate's version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
