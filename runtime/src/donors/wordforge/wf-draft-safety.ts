// Keeps typed words from vanishing between one deliberate save and the next.
//
// The room used to save on blur alone. `blur` does not fire when a tab closes,
// so a paragraph with the caret still in it was never sent — the single most
// expensive defect in the writing surface.
//
// Two mechanisms, deliberately layered, because neither is sufficient alone:
//
//   1. An idle flush. Typing stops for `idleMs`, the paragraph saves. This is a
//      real network save through the room's normal path, so it carries the same
//      conflict handling as a blur save.
//   2. A leave flush on `pagehide` and on `visibilitychange` to hidden. This is
//      best-effort: the browser may kill the request. It is the reason the
//      caller ALSO writes a device-local draft on every keystroke — see
//      wf-local-drafts.ts. The local draft is synchronous and cannot be killed.
//
// This is not a keystroke stream to the server. The idle window keeps commits
// discrete, which is the stance store.ts takes on the other side of the wire.

import { useEffect, useRef } from 'react';

export interface PendingEdit {
  passageId: string;
  paragraphId: string;
  text: string;
}

export interface DraftSafetyOptions {
  // Save one paragraph. The room's existing save path, passed in so this hook
  // stays free of transport concerns and is trivially testable.
  save: (passageId: string, paragraphId: string, text: string) => void;
  idleMs?: number;
}

export interface DraftSafety {
  // Call on every edit. Replaces any earlier pending edit for that paragraph.
  note: (edit: PendingEdit) => void;
  // Call when a paragraph has been saved by another route (a blur, say), so the
  // idle timer does not save it a second time.
  forget: (paragraphId: string) => void;
  // Save everything pending now.
  flush: () => void;
  // Test seam: what is waiting.
  pending: () => PendingEdit[];
}

export const DEFAULT_IDLE_MS = 5000;

export function useDraftSafety({ save, idleMs = DEFAULT_IDLE_MS }: DraftSafetyOptions): DraftSafety {
  const pendingRef = useRef<Map<string, PendingEdit>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useRef(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current.size === 0) return;
    const edits = Array.from(pendingRef.current.values());
    pendingRef.current.clear();
    for (const edit of edits) {
      try {
        saveRef.current(edit.passageId, edit.paragraphId, edit.text);
      } catch {
        // One paragraph failing must not strand the rest of the flush. The
        // room's own failure line reports it; the device draft still holds it.
      }
    }
  }).current;

  const note = useRef((edit: PendingEdit) => {
    pendingRef.current.set(edit.paragraphId, edit);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, idleMs);
  }).current;

  const forget = useRef((paragraphId: string) => {
    pendingRef.current.delete(paragraphId);
    if (pendingRef.current.size === 0 && timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }).current;

  const pending = useRef(() => Array.from(pendingRef.current.values())).current;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPageHide = () => flush();
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      // Unmounting is also a leave. Navigating away from the piece within the
      // app never touched blur on the focused paragraph either.
      flush();
    };
  }, [flush]);

  return { note, forget, flush, pending };
}
