import { useCallback, useRef, useState } from "react";

/**
 * Returns a [copied, copy] tuple. `copy(text)` writes to the clipboard and
 * sets `copied = true` for `ms` milliseconds, then resets — use it to swap
 * a Copy icon for a Check icon without a browser alert().
 */
export function useCopyFeedback(ms = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), ms);
    },
    [ms],
  );

  return [copied, copy] as const;
}
