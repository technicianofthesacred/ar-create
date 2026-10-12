// Adapted actual i64os terminal/pty-manager.ts.
// Own deps, known executables, profile-free shell, allowlisted env. Lifetime belongs
// to the project service, not any browser/socket/view; disconnect never kills it.
// i64os — PTY manager (the runtime half of the embedded board terminal).
//
// Owns the module-level Map<sessionId, IPty> and the full PTY lifecycle for a
// single ws attach: spawn the chosen CLI in the constrained cwd, pipe data both
// ways, enforce idle-reap + hard-max timeouts, and tear down on exit/close.
//
// SECURITY: only the three known CLIs are ever spawned — never an arbitrary
// command string. One PTY per session (second attach refused). Every
// spawn/exit/kill is audited by the caller via the supplied hooks.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pty = null;try {pty=require('node-pty');} catch {}
export const nativePtyAvailable = () => Boolean(pty?.spawn);
                                     
                                                                                                                 

// ── tunables (defensive defaults; env-overridable) ──────────────────────────
function envMs(name        , fallback        )         {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const IDLE_MS = () => envMs('AR_CREATE_TERMINAL_IDLE_MS', 24 * 60 * 60 * 1000); // 15m
const MAX_MS = () => envMs('AR_CREATE_TERMINAL_MAX_MS', 24 * 60 * 60 * 1000); // 2h

                                 
                        
                       
                                                                           
                        
                                                                              
                                                                  
                                  
                           
 

/**
 * Map a VS Code-style mode + auto-run to a REAL claude `--permission-mode` value.
 *
 * The installed `claude --help` exposes:
 *   --permission-mode <mode>  (choices: acceptEdits, auto, bypassPermissions,
 *                              default, dontAsk, plan)
 *
 * Honest mapping (no invented flags):
 *   plan          → 'plan'        — read-only planning, never edits.
 *   ask           → 'default'     — asks before each action (auto_run n/a).
 *   edit / agent  → auto_run ON  → 'acceptEdits'  (operator opted into auto-accept)
 *                   auto_run OFF → 'default'      (NEVER auto-accept silently)
 *
 * SAFETY: auto_run OFF can only ever yield 'default' — it never emits an
 * auto-accept value. We never emit 'auto'/'dontAsk'/'bypassPermissions' from the
 * workbench (those skip prompts beyond what the operator asked for).
 */
function claudePermissionMode(
  mode                                      ,
  autoRun                            ,
)                                     {
  const m = mode ?? 'agent'; // default to agent when unset (legacy rows)
  switch (m) {
    case 'plan':
      return 'plan';
    case 'ask':
      return 'default';
    case 'edit':
    case 'agent':
    default:
      return autoRun === true ? 'acceptEdits' : 'default';
  }
}

/**
 * Resolve the binary + argv for a CLI. Never a caller-supplied command.
 *
 * When a `seed` is present (a context-loaded claude/codex session), it is passed
 * as the single positional INITIAL-PROMPT argument: `claude [flags] "<seed>"` /
 * `codex "<seed>"`. This starts the CLI INTERACTIVELY with the seed as its first
 * message — NOT `-p`/print mode (non-interactive). node-pty spawns the binary
 * directly with this argv (no shell), so the seed is pure argv data: there is no
 * shell-quoting / command-injection surface.
 *
 * Permission flags precede the positional seed. Claude uses --permission-mode;
 * Codex uses explicit --sandbox and --ask-for-approval flags (verified against
 * the installed CLI's --help), so permissive user defaults cannot decide the
 * workbench's permissions. Ask can request approval; plan stays read-only without
 * escalation. Edit/agent only auto-accept workspace writes with explicit autoRun.
 * A shell session NEVER receives a seed or a permission flag.
 */
const SAFE_MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/;

export function _commandFor(opts                )                                   {
  const { cli, seed } = opts;
  const hasSeed = typeof seed === 'string' && seed.length > 0;
  const model = opts.model ?? null;
  if (model !== null && !SAFE_MODEL.test(model)) throw new Error('invalid terminal model');
  switch (cli) {
    case 'claude': {
      const permMode = claudePermissionMode(opts.mode, opts.autoRun);
      // Flags first, then the positional seed prompt (claude [options] [prompt]).
      const args           = ['--permission-mode', permMode];
      if (model) args.push('--model', model);
      if (hasSeed) args.push(seed          );
      return { file: 'claude', args };
    }
    case 'codex': {
      const mode = opts.mode ?? 'agent';
      const autoEdit = (mode === 'edit' || mode === 'agent') && opts.autoRun === true;
      const args = ['--sandbox', autoEdit ? 'workspace-write' : 'read-only',
        '--ask-for-approval', mode === 'plan' ? 'never' : 'on-request'];
      if (model) args.push('--model', model);
      if (hasSeed) args.push(seed);
      return {
        file: 'codex',
        args,
      };
    }
    case 'shell':
    default:
      return { file: '/bin/zsh', args: ['-f'] }; // No login/profile scripts.
  }
}

/**
 * A sanitized env for the spawned PTY. Inherits the parent env (the CLIs need
 * PATH, HOME, auth tokens in env) but strips i64os-internal secrets that have
 * no business inside an interactive shell.
 */
function sanitizedEnv()                    {
 const env                    = {};
 for(const key of ['PATH','HOME','USER','LOGNAME','LANG','LC_ALL','TMPDIR'])if(process.env[key])env[key]=process.env[key];
 env.TERM='xterm-256color';
 return env;
}

                       
            
                            
                           
                  
 

const live = new Map                     ();

/** True if a PTY is already attached for this session. */
export function isAttached(sessionId        )          {
  return live.has(sessionId);
}

                              
                                                
                            
                                 
                                           
                                                           
               
 

                             
                                                    
                             
                                                                               
                                                                             
                                                        
                                 
 

                             
                    
                        
                                                         
                
                
                                                                                
                                                                              
                                                                            
                       
                                                                              
                                                                            
                                  
                           
                        
                                                                                 
                                  
 

/**
 * Spawn a PTY for a session and register it in the Map. Returns a handle for
 * input/resize/kill, or null if a PTY is already attached (single-attach) — the
 * caller must reject the second ws.
 *
 * onError is invoked (and the session removed) if the spawn throws, e.g. the
 * CLI binary isn't found. The process must NEVER crash on a bad spawn.
 */
export function spawnForSession(
  input            ,
  hooks            ,
)                     {
  if (live.has(input.sessionId)) return null; // single-attach

  let child      ;
  try {
    // Only context-loaded coding CLIs get a seed argv; commandFor ignores any
    // seed for a shell. The seed is a single argv element (data), spawned with
    // the binary directly — no shell, so no injection surface. Mode/autoRun
    // map to each coding CLI's explicit permission flags; shell ignores them.
    const { file, args } = _commandFor({
      cli: input.cli,
      seed: input.seed,
      mode: input.mode,
      autoRun: input.autoRun,
      model: input.model,
    });
    const environment = input.environment ? { ...input.environment } : sanitizedEnv();
    environment.TERM = environment.TERM || 'xterm-256color';
    if (!pty) throw new Error('Native PTY unavailable. Install ar-create dependencies with npm ci.');
    child = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols: input.cols && input.cols > 0 ? input.cols : 80,
      rows: input.rows && input.rows > 0 ? input.rows : 24,
      cwd: input.cwd,
      env: environment,
    });
  } catch (err) {
    // ENOENT (CLI not installed) or any spawn failure — report, don't crash.
    hooks.onError((err         ).message || 'failed to spawn terminal');
    return null;
  }

  const session              = {
    pty: child,
    killed: false,
    idleTimer: undefined                             ,
    maxTimer: undefined                             ,
  };

  const teardown = (reason                                    , code        ) => {
    if (!live.has(input.sessionId)) return; // already torn down
    clearTimeout(session.idleTimer);
    clearTimeout(session.maxTimer);
    live.delete(input.sessionId);
    hooks.onExit(code, reason);
  };

  const armIdle = () => {
    clearTimeout(session.idleTimer);
    session.idleTimer = setTimeout(() => {
      session.killed = true;
      try {
        child.kill();
      } catch {
        /* already dead */
      }
      teardown('idle', -1);
    }, IDLE_MS());
  };

  // Hard max lifetime — fires regardless of activity.
  session.maxTimer = setTimeout(() => {
    session.killed = true;
    try {
      child.kill();
    } catch {
      /* already dead */
    }
    teardown('max', -1);
  }, MAX_MS());

  armIdle();

  child.onData((data        ) => {
    hooks.onData(data);
  });

  child.onExit(({ exitCode }                      ) => {
    // If we initiated the kill (idle/max/explicit), teardown already ran for the
    // idle/max paths; for an explicit kill() we let this exit event run teardown.
    teardown(session.killed ? 'killed' : 'exit', exitCode);
  });

  live.set(input.sessionId, session);

  return {
    write(data        ) {
      armIdle(); // input resets the idle clock
      try {
        child.write(data);
      } catch {
        /* PTY gone; ignore */
      }
    },
    resize(cols        , rows        ) {
      try {
        child.resize(Math.max(1, cols | 0), Math.max(1, rows | 0));
      } catch {
        /* PTY gone; ignore */
      }
    },
    kill() {
      const s = live.get(input.sessionId);
      if (!s) return;
      s.killed = true;
      try {
        s.pty.kill();
      } catch {
        // PTY already dead — synthesize the teardown so the row is closed.
        teardown('killed', -1);
      }
    },
  };
}

/** Kill a live PTY by session id from outside the ws (e.g. DELETE route). */
export function killSession(sessionId        )          {
  const s = live.get(sessionId);
  if (!s) return false;
  s.killed = true;
  try {
    s.pty.kill();
  } catch {
    /* already dead — the onExit/teardown path handles cleanup */
  }
  return true;
}
