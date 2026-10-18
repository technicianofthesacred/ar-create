from pathlib import Path
import subprocess,json,time,os,socket,fcntl,shutil
home=Path(__file__).resolve().parent
def canonical(candidate):
 for part in [candidate,*candidate.parents]:
  assert not part.is_symlink(),'Symlinked installed paths are refused'
 return candidate
for item in ['service','service/serve.mjs','config','config/local.json','state','logs','state/launch.lock','state/server-status.json','state/server-status.tmp','logs/server.log']:canonical(home/item)
assert (home/'config/local.json').is_file(),'Install this template only into an explicitly configured permanent home'
(home/'state').mkdir(mode=0o700,exist_ok=True)
lock=(home/'state/launch.lock').open('a')
fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
try:
 with socket.create_connection(('127.0.0.1',8841),timeout=1):raise SystemExit('Existing listener preserved; inspect its identity before starting another owner.')
except (ConnectionRefusedError,TimeoutError):pass
node_path=os.environ.get('AR_CREATE_NODE') or shutil.which('node')
assert node_path and Path(node_path).is_absolute(),'An explicit absolute Node executable is required'
node=Path(node_path).resolve();serve=home/'service/serve.mjs'
assert node.is_file() and serve.is_file() and (home/'config/local.json').is_file(),'Permanent service configuration incomplete'
logfile=home/'logs/server.log';logfile.touch(mode=0o600,exist_ok=True)
env={k:os.environ[k] for k in ['HOME','PATH','USER','LANG','LC_ALL','TMPDIR'] if k in os.environ};env['AR_CREATE_CONFIG']=str(home/'config/local.json')
with logfile.open('ab',buffering=0) as log:
 p=subprocess.Popen([str(node),str(serve)],cwd=home,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True,close_fds=True)
 status={'pid':p.pid,'node':str(node),'url':'http://127.0.0.1:8841/document-study/index.html','launcher':str(home/'start.py'),'service':str(serve),'startedAt':time.time(),'state':'starting'}
 def persist():
  target=home/'state/server-status.json';tmp=target.with_suffix('.tmp');fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as file:file.write(json.dumps(status,indent=2))
  os.replace(tmp,target)
 persist()
 import urllib.request
 for _ in range(30):
  if p.poll() is not None:status['state']='failed';persist();raise SystemExit('Service exited; inspect permanent logs. Existing data preserved.')
  try:
   with urllib.request.urlopen('http://127.0.0.1:8841/api/i64os/health',timeout=.5) as r:body=json.load(r)
   if body=={'service':'ar-create-document-study','ready':True}:status['state']='listening';persist();print('AR Create listening; PID '+str(p.pid));break
  except (OSError,ValueError):pass
  time.sleep(.2)
 else:raise SystemExit('Startup incomplete; inspect permanent state and log before retry.')
