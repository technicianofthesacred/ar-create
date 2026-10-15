import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import './wordforge-terminal.css';

export function WordforgeTerminal({ sessionId, output, input, resize, onDraft, readOnly = false, allowReplyReview = true }: {
  sessionId: string; output: string; input: (data: string) => void;
  resize: (cols: number, rows: number) => void; onDraft: (text: string) => void; readOnly?: boolean; allowReplyReview?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const written = useRef('');
  const measureTerminal = useRef<() => void>(() => {});
  const handlers = useRef({ input, resize });
  handlers.current = { input, resize };
  const [selection, setSelection] = useState('');
  const [selectableOutput, setSelectableOutput] = useState<string | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const styles = getComputedStyle(host.current);
    const terminal = new Terminal({
      convertEol: true, cursorBlink: !readOnly, disableStdin: readOnly, fontSize: 14, lineHeight: 1.35,
      fontFamily: 'Geist Mono, ui-monospace, monospace', scrollback: 3000,
      screenReaderMode: true,
      theme: { background: styles.getPropertyValue('--wr-ground').trim(), foreground: styles.getPropertyValue('--wr-prose').trim() },
    });
    const fit = new FitAddon(); terminal.loadAddon(fit); terminal.open(host.current); term.current = terminal;
    let measuredCols=0,measuredRows=0,active=true;
    const measure = () => {
      if (!active || !host.current?.clientWidth || !host.current.clientHeight) return;
      try { fit.fit(); if(terminal.cols!==measuredCols||terminal.rows!==measuredRows){measuredCols=terminal.cols;measuredRows=terminal.rows;handlers.current.resize(terminal.cols, terminal.rows);} } catch { /* Hidden tab, measured on return. */ }
    };
    measureTerminal.current=measure;
    const observer = new ResizeObserver(measure); observer.observe(host.current); measure();
    // The first layout and font metrics can settle after xterm.open().
    const settled=setTimeout(measure,0);
    void document.fonts?.ready.then(()=>{if(active)measure();});
    const keyboard = terminal.onData(data => { if (!readOnly) handlers.current.input(data); });
    const selected = terminal.onSelectionChange(() => setSelection(terminal.getSelection()));
    // A different PTY gets a fresh viewport; disposing also drops queued old
    // writes. Reconnects to this same ID retain the existing viewport and history.
    written.current = ''; setSelection(''); setSelectableOutput(null);
    return () => { active=false;clearTimeout(settled);measureTerminal.current=()=>{};observer.disconnect(); keyboard.dispose(); selected.dispose(); terminal.dispose(); term.current = null; };
  }, [sessionId, readOnly]);
  useEffect(() => {
    const terminal = term.current;
    if (!terminal) return;
    const delta = terminalOutputDelta(written.current, output);
    if (delta) terminal.write(delta);
    if (!written.current.startsWith(output)) written.current = output;
  }, [sessionId, output]);
  useEffect(()=>{if(!allowReplyReview){setSelection('');setSelectableOutput(null);}},[allowReplyReview]);
  useEffect(()=>{if(selectableOutput===null)measureTerminal.current();},[selectableOutput]);
  return <div className="wr-real-terminal">
    <div ref={host} className="wr-xterm-host" aria-label={readOnly ? "Previous terminal output" : "Live writing terminal"} onPointerDown={()=>term.current?.focus?.()} style={selectableOutput === null ? undefined : { display: 'none' }} />
    {selectableOutput !== null && <textarea autoFocus readOnly className="wr-terminal-copy" aria-label="Select terminal reply" value={selectableOutput} onSelect={event => {
      const field = event.currentTarget;
      setSelection(field.value.slice(field.selectionStart, field.selectionEnd));
    }} />}
    <div className="wr-terminal-selection">
      {allowReplyReview&&<button className="wr-secondary" type="button" onClick={() => {
        setSelection('');
        if (selectableOutput !== null) { setSelectableOutput(null); setTimeout(()=>term.current?.focus?.(),0); return; }
        const buffer = term.current?.buffer.active;
        if (!buffer) return;
        const lines: string[] = [];
        for (let i = 0; i < buffer.length; i++) lines.push(buffer.getLine(i)?.translateToString(true) ?? '');
        setSelectableOutput(lines.join('\n').trimEnd());
      }}>{selectableOutput === null ? 'Select text' : 'Return to terminal'}</button>}
      {allowReplyReview&&<button className="wr-secondary" type="button" disabled={!selection.trim()} onClick={() => onDraft(selection)}>Review selected text</button>}
      {!readOnly && <button className="wr-secondary wr-terminal-focus" type="button" disabled={selectableOutput!==null} onClick={()=>{measureTerminal.current();term.current?.focus?.();}}>Focus terminal</button>}
      {allowReplyReview&&<span>Review a reply before adding it to Your writing.</span>}
    </div>
  </div>;
}

// Reconnect may replay an older snapshot or the suffix retained by the service's
// output limit. Neither starts a different process or clears its visible history.
export function terminalOutputDelta(previous: string, next: string): string {
  if (next.startsWith(previous)) return next.slice(previous.length);
  if (previous.startsWith(next) || previous.endsWith(next)) return '';
  if (!next) return '';
  // Find the longest old suffix matching the new prefix in linear time, even
  // for a terminal with many identical redraws. Only unseen bytes are written.
  const prefix = new Uint32Array(next.length);
  for (let i = 1, length = 0; i < next.length; i++) {
    while (length && next[i] !== next[length]) length = prefix[length - 1];
    if (next[i] === next[length]) length++;
    prefix[i] = length;
  }
  let overlap = 0;
  for (let i = Math.max(0, previous.length - next.length); i < previous.length; i++) {
    while (overlap && (overlap === next.length || previous[i] !== next[overlap])) overlap = prefix[overlap - 1];
    if (previous[i] === next[overlap]) overlap++;
  }
  return next.slice(overlap);
}
