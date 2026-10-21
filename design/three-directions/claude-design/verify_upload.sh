#!/bin/zsh
# verify_upload.sh <serve_url> <local file> : diffs the canvas copy against the local file, ignoring the host's injected preview script
curl -s "$1" > "$TMPDIR/up.html"
python3 - "$TMPDIR/up.html" "$2" <<'PY'
import sys
a=open(sys.argv[1]).read(); b=open(sys.argv[2]).read()
import re
a=re.sub(r'<style data-omelette-injected>.*?</style>','',a,flags=re.S); a=re.sub(r'<script data-omelette-injected>.*?</script>','',a,flags=re.S)
n=lambda s:[l for l in s.splitlines() if l.strip()]
print("MATCH" if n(a)==n(b) else f"DIFF up={len(a)} local={len(b)}")
PY
