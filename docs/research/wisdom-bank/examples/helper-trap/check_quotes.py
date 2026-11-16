import json, re, sys
tx_path, data_path = sys.argv[1], sys.argv[2]
lines = []
for ln in open(tx_path):
    m = re.match(r"\[(\d+):(\d+)\] (.*)", ln.strip())
    if m:
        lines.append((int(m.group(1)) * 60 + int(m.group(2)), m.group(3)))
# Build one string, remembering where each caption line starts
full, starts = "", []
for sec, text in lines:
    starts.append((len(full), sec))
    full += text + " "
norm = lambda s: re.sub(r"\s+", " ", s).strip()
full = norm(full)
d = json.load(open(data_path))
bad = 0
for c in d["concepts"]:
    for q in c["quotes"]:
        i = full.find(norm(q["text"]))
        if i < 0:
            bad += 1
            print("NOT FOUND:", c["id"], q["t"], q["text"][:70])
            continue
        sec = max(s for pos, s in starts if pos <= i)
        claimed = sum(int(x) * k for x, k in zip(q["t"].split(":"), (60, 1)))
        flag = "" if abs(sec - claimed) <= 3 else f"  (time off: caption at {sec//60}:{sec%60:02d})"
        print("ok", c["id"], q["t"], flag)
print("not found:", bad)
