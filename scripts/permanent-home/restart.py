from pathlib import Path
import subprocess,sys
home=Path(__file__).resolve().parent
subprocess.run([sys.executable,str(home/'stop.py')],check=True)
subprocess.run([sys.executable,str(home/'start.py')],check=True)
