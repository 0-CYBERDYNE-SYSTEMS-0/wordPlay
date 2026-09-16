import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AgentApplyDialogProps {
  open: boolean;
  tool: string;
  reason?: string;
  before: string;
  after: string;
  newTitle?: string;
  onApply: () => void;
  onCancel: () => void;
}

const countWords = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;

/**
 * Confirmation for whole-document agent writes. The agent's proposal is never
 * applied silently — the writer sees before/after and applies (undoable) or cancels.
 */
export default function AgentApplyDialog({
  open,
  tool,
  reason,
  before,
  after,
  newTitle,
  onApply,
  onCancel,
}: AgentApplyDialogProps) {
  const stats = useMemo(() => {
    const wordsBefore = countWords(before);
    const wordsAfter = countWords(after);
    const delta = wordsAfter - wordsBefore;
    return {
      charsBefore: before.length,
      charsAfter: after.length,
      words: `${wordsBefore.toLocaleString()} → ${wordsAfter.toLocaleString()} words (${delta >= 0 ? "+" : ""}${delta.toLocaleString()})`,
    };
  }, [before, after]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Agent wants to rewrite the document</DialogTitle>
          <DialogDescription>
            Tool <span className="font-mono text-xs">{tool}</span>
            {reason ? ` — ${reason}` : ""}. Nothing is applied until you approve; applying is undoable with ⌘Z.
          </DialogDescription>
        </DialogHeader>

        {newTitle && newTitle !== "" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950">
            <span className="font-medium">Title change:</span> “{newTitle}”
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-1 text-xs font-medium text-stone-500 dark:text-stone-400">Current</div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-red-200 bg-red-50/60 p-2 font-mono text-xs text-stone-700 dark:border-red-900 dark:bg-red-950/40 dark:text-stone-300">
              {before || "(empty)"}
            </pre>
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-xs font-medium text-stone-500 dark:text-stone-400">Proposed</div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-emerald-200 bg-emerald-50/60 p-2 font-mono text-xs text-stone-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-stone-300">
              {after || "(empty)"}
            </pre>
          </div>
        </div>

        <div className="text-xs text-stone-500 dark:text-stone-400">
          {stats.words} · {stats.charsBefore.toLocaleString()} → {stats.charsAfter.toLocaleString()} characters
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onApply}>Apply rewrite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
