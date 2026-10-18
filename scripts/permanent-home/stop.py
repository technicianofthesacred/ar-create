from pathlib import Path
import json,os,signal,subprocess,time
home=Path(__file__).resolve().parent
for candidate in [home/'state/server-status.json',home/'service/serve.mjs']:
 for part in [candidate,*candidate.parents]:
  if part.is_symlink():raise SystemExit('Symlinked installed paths are refused; process preserved.')
status=json.loads((home/'state/server-status.json').read_text());pid=status['pid'];expected=str(home/'service/serve.mjs')
r=subprocess.run(['ps','-p',str(pid),'-o','command='],capture_output=True,text=True)
if r.returncode:raise SystemExit('Recorded service is already stopped; no other process touched.')
if not status.get('node') or r.stdout.strip()!=status['node']+' '+expected:raise SystemExit('PID identity changed; process preserved.')
os.kill(pid,signal.SIGTERM)
for _ in range(30):
 try:os.kill(pid,0)
 except ProcessLookupError:break
 time.sleep(.2)
else:raise SystemExit('Service has not stopped; no force kill performed.')
status['state']='stopped';(home/'state/server-status.json').write_text(json.dumps(status,indent=2));print('AR Create stopped; saved files preserved.')
