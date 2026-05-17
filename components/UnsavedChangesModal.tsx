"use client";

import { AlertTriangle } from "lucide-react";

interface UnsavedChangesModalProps {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({ onSave, onDiscard, onCancel }: UnsavedChangesModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      onClick={onCancel}
    >
      <div
        className="glass rounded-xl p-6 max-w-sm w-full flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <h2 className="text-sm font-bold text-[#e5e5e5]">Unsaved Changes</h2>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Your current project has unsaved changes. Save before leaving to keep your work.
        </p>
        <div className="flex flex-col gap-2 mt-1">
          <button
            onClick={onSave}
            className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Save &amp; Continue
          </button>
          <button
            onClick={onDiscard}
            className="w-full py-2 rounded-lg border border-[#2a2a2a] hover:border-red-500/50 hover:text-red-400 text-neutral-400 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Discard Changes
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 rounded-lg text-neutral-600 hover:text-neutral-400 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
