"""Builds the direction pages and the Compare page of the Claude Design canvas from directions.json.
Run: python3 build_pages.py   (writes *.dc.html beside this file)"""
import json, html, pathlib

HERE = pathlib.Path(__file__).parent
D = json.loads((HERE / "directions.json").read_text())

HEAD = """<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <script src="./support.js"></script>
  </head>
  <body>
    <x-dc>
      <helmet data-dc-atomics>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&amp;family=Lora:wght@400;500&amp;display=swap" rel="stylesheet" />
        <style>
          body{{margin:0;background:#141310}}
          a{{color:#c9a874;text-decoration:none}}
          a:hover{{text-decoration:underline}}
          .pg{{--bg:#141310;--paper:#1d1b16;--ink:#e7e1d3;--dim:#a39e8e;--line:#2d2a23;--warm:#c9a874;--rail:#191813;--sel:#2c2a22;--good:#8fb08a;--warnc:#d9a95a;--bad:#e08a74;background:var(--bg);color:var(--ink);font:15px/1.55 'Plus Jakarta Sans',system-ui,sans-serif;min-height:100vh;padding:40px 24px 80px}}
          .wrap{{max-width:1320px;margin:0 auto;display:flex;flex-direction:column;gap:44px}}
          .kick{{color:var(--warm);font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin:0}}
          .h1{{font-size:32px;font-weight:700;line-height:1.15;margin:6px 0 10px;text-wrap:balance}}
          .lede{{color:var(--dim);font-size:17px;max-width:760px;margin:0;text-wrap:pretty}}
          .h2{{font-size:18px;font-weight:600;margin:0 0 6px}}
          .sub{{color:var(--dim);font-size:14px;margin:0 0 16px;max-width:760px}}
          .frames{{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:20px;align-items:start}}
          .fr{{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--paper)}}
          .frl{{display:flex;justify-content:space-between;gap:12px;padding:8px 12px;border-bottom:1px solid var(--line);font-size:12px;color:var(--dim)}}
          .ifd{{display:block;width:100%;height:760px;border:0;background:var(--bg)}}
          .ifm{{display:block;width:390px;height:760px;border:0;background:var(--bg)}}
          .two{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px}}
          .row{{display:grid;grid-template-columns:130px minmax(0,1fr);gap:4px 16px;padding:10px 0;border-top:1px solid var(--line)}}
          .rk{{color:var(--dim);font-size:13px}}
          .crit{{display:grid;grid-template-columns:36px 210px 96px minmax(0,1fr);gap:4px 14px;padding:10px 0;border-top:1px solid var(--line);align-items:baseline}}
          .num{{color:var(--warm);font-weight:600;font-size:13px}}
          .v{{font-size:12px;padding:1px 8px;border-radius:4px;border:1px solid;justify-self:start}}
          .v.meets{{color:var(--good);border-color:var(--good)}}
          .v.partial{{color:var(--warnc);border-color:var(--warnc)}}
          .v.missing{{color:var(--bad);border-color:var(--bad)}}
          .score{{display:flex;gap:16px;font-size:14px;color:var(--dim);margin:0 0 8px}}
          .fixes{{display:flex;flex-direction:column;gap:28px}}
          .fix{{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:24px;border-top:1px solid var(--line);padding-top:20px}}
          .ft{{font-size:16px;font-weight:600;margin:4px 0 8px}}
          .fb{{color:var(--dim);margin:0 0 8px;text-wrap:pretty}}
          .ba{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}}
          .mock{{border:1px solid var(--line);border-radius:8px;background:var(--bg);overflow:hidden;font-size:13px}}
          .mock.after{{border-color:var(--warm)}}
          .ml{{padding:6px 10px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line)}}
          .mock.after .ml{{color:var(--warm)}}
          .mb{{padding:12px;display:flex;flex-direction:column;gap:8px;min-height:180px}}
          .bar{{display:flex;gap:8px;align-items:center;flex-wrap:wrap}}
          .blk{{background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:8px 10px}}
          .tag{{font-size:11px;padding:1px 6px;border:1px solid var(--line);border-radius:4px;color:var(--dim)}}
          .tag.w{{color:var(--warm);border-color:var(--warm)}}
          .tag.s{{color:var(--warnc);border-color:var(--warnc)}}
          .hl{{background:color-mix(in srgb,var(--warm) 22%,transparent);border-radius:2px}}
          .ms{{font-family:system-ui,sans-serif;font-size:14px;line-height:1.6}}
          .dimt{{color:var(--dim)}}
          .stack{{display:flex;flex-direction:column;gap:6px}}
          .cols{{display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:6px}}
          .note{{border-top:1px solid var(--line);padding-top:16px;color:var(--dim);font-size:13px}}
          .cmp{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}}
          .cmph{{display:flex;flex-direction:column;gap:4px;margin:0 0 10px}}
          .ifc{{display:block;width:100%;height:620px;border:0;background:var(--bg)}}
          .tbl{{display:grid;grid-template-columns:200px repeat(3,minmax(0,1fr));gap:0 16px}}
          .tbl > div{{padding:10px 0;border-top:1px solid var(--line)}}
          .th{{color:var(--dim);font-size:13px}}
          @media (max-width:1000px){{.frames,.fix,.cmp{{grid-template-columns:minmax(0,1fr)}}.crit{{grid-template-columns:36px minmax(0,1fr)}}.tbl{{grid-template-columns:minmax(0,1fr)}}}}
        </style>
      </helmet>
"""

TAIL = """    </x-dc>
    <script type="text/x-dc" data-dc-script data-props='{}'>
      class Component extends DCLogic {
        renderVals() { return {}; }
      }
    </script>
  </body>
</html>
"""

e = html.escape


def direction_page(d):
    proto = f"prototypes/{d['dir']}/index.html"
    out = [HEAD.format(title=f"{d['letter']} {d['name']}")]
    out.append(f'      <div class="pg" data-screen-label="{d["letter"]} {e(d["name"])}">\n        <div class="wrap">\n')
    out.append(f'''          <div>
            <p class="kick">Direction {d['letter']} · <a href="https://claude.ai/design/p/dac191b6-fa50-432b-983f-a27966fdd3ee?file=Start%20here.dc.html" target="_top">Start here</a> · <a href="https://claude.ai/design/p/dac191b6-fa50-432b-983f-a27966fdd3ee?file=Compare.dc.html" target="_top">Compare</a></p>
            <h1 class="h1">{e(d['name'])}</h1>
            <p class="lede">{e(d['idea'])}</p>
          </div>
''')
    out.append(f'''          <div>
            <h2 class="h2">The prototype</h2>
            <p class="sub">Live and clickable. Invented content; nothing saves, no AI runs. Built by another session — this canvas shows it unedited.</p>
            <div class="frames">
              <div class="fr"><div class="frl"><span>Desktop</span><a href="https://claude.ai/design/p/dac191b6-fa50-432b-983f-a27966fdd3ee?file=prototypes%2F{d['dir']}%2Findex.html" target="_top">Open full screen →</a></div><iframe class="ifd" src="{proto}" title="Direction {d['letter']} desktop"></iframe></div>
              <div class="fr"><div class="frl"><span>Phone · 390px</span></div><iframe class="ifm" src="{proto}" title="Direction {d['letter']} phone"></iframe></div>
            </div>
          </div>
''')
    rows = "".join(f'              <div class="row"><span class="rk">{e(k)}</span><span>{e(v)}</span></div>\n' for k, v in d["notes"])
    out.append(f'''          <div class="two">
            <div>
              <h2 class="h2">From the builder's notes</h2>
{rows}            </div>
            <div>
              <h2 class="h2">Critique in one paragraph</h2>
              <p class="fb" style="color:var(--ink)">{e(d['summary'])}</p>
            </div>
          </div>
''')
    counts = {k: sum(1 for c in d["critique"] if c[1] == k) for k in ("meets", "partial", "missing")}
    crit = "".join(
        f'            <div class="crit"><span class="num">{i+1:02d}</span><span>{e(c[0])}</span><span class="v {c[1]}">{c[1].capitalize()}</span><span class="dimt">{e(c[2])}</span></div>\n'
        for i, c in enumerate(d["critique"]))
    out.append(f'''          <div>
            <h2 class="h2">Against the 13 must-haves</h2>
            <p class="score"><span>Meets {counts['meets']}</span><span>Partial {counts['partial']}</span><span>Missing {counts['missing']}</span></p>
{crit}          </div>
''')
    fx = []
    for i, f in enumerate(d["fixes"]):
        fx.append(f'''            <div class="fix" data-screen-label="{d['letter']} fix {i+1}">
              <div>
                <span class="num">Fix {i+1} · must-have {f['mh']}</span>
                <p class="ft">{e(f['title'])}</p>
                <p class="fb">{e(f['why'])}</p>
                <p class="fb">{e(f['change'])}</p>
              </div>
              <div class="ba">
                <div class="mock"><div class="ml">Now</div><div class="mb">{f['before']}</div></div>
                <div class="mock after"><div class="ml">Proposed variant</div><div class="mb">{f['after']}</div></div>
              </div>
            </div>
''')
    out.append(f'''          <div>
            <h2 class="h2">Top three fixes, as variants</h2>
            <p class="sub">Proposals only. The prototype file is not changed; these sketches show the structural change in the same look.</p>
            <div class="fixes">
{''.join(fx)}            </div>
          </div>
''')
    out.append("        </div>\n      </div>\n")
    out.append(TAIL)
    return "".join(out)


def compare_page(ds):
    out = [HEAD.format(title="Compare")]
    out.append('      <div class="pg" data-screen-label="Compare">\n        <div class="wrap" style="max-width:1600px">\n')
    out.append('''          <div>
            <p class="kick"><a href="https://claude.ai/design/p/dac191b6-fa50-432b-983f-a27966fdd3ee?file=Start%20here.dc.html" target="_top">Start here</a> · Compare</p>
            <h1 class="h1">All three, side by side</h1>
            <p class="lede">Same records, same twelve sections, same look. What differs is what you see first and how you move.</p>
          </div>
''')
    cards = "".join(f'''            <div>
              <div class="cmph"><span class="num">{d['letter']}</span><span class="ft" style="margin:0">{e(d['name'])}</span><span class="dimt">{e(d['short'])}</span><a href="https://claude.ai/design/p/dac191b6-fa50-432b-983f-a27966fdd3ee?file={d['file']}" target="_top">Direction page →</a></div>
              <div class="fr"><iframe class="ifc" src="prototypes/{d['dir']}/index.html" title="Direction {d['letter']}"></iframe></div>
            </div>
''' for d in ds)
    out.append(f'          <div class="cmp">\n{cards}          </div>\n')
    tbl = ['          <div>\n            <h2 class="h2">How they differ</h2>\n            <div class="tbl">\n              <div class="th"></div>']
    tbl += [f'<div class="ft" style="margin:0">{d["letter"]} {e(d["name"])}</div>' for d in ds]
    tbl.append("\n")
    for key in ds[0]["compare"]:
        tbl.append(f'              <div class="th">{e(key)}</div>' + "".join(f'<div>{e(d["compare"][key])}</div>' for d in ds) + "\n")
    tbl.append("              <div class=\"th\">Must-haves met</div>" + "".join(
        f'<div>{sum(1 for c in d["critique"] if c[1]=="meets")} of 13 · partial {sum(1 for c in d["critique"] if c[1]=="partial")}</div>' for d in ds) + "\n")
    tbl.append("            </div>\n          </div>\n")
    out.append("".join(tbl))
    out.append(f'          <div>\n            <h2 class="h2">Recommendation</h2>\n            <p class="lede" style="color:var(--ink)">{e(D["recommendation"])}</p>\n          </div>\n')
    out.append("        </div>\n      </div>\n")
    out.append(TAIL)
    return "".join(out)


ready = [d for d in D["directions"] if d.get("critique")]
for d in ready:
    (HERE / d["file"].replace("%20", " ")).write_text(direction_page(d))
if len(ready) == 3:
    (HERE / "Compare.dc.html").write_text(compare_page(ready))
print("built", [d["letter"] for d in ready])
