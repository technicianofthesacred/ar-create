// The parts page: every coss ui part and every one of its examples, rendered from coss's own code in AR Create's
// colours. Laid out like coss's docs: a top bar, a side list, and each example on its own preview panel.
// Addresses: #/ is the overview (colours, then the first example of every part); #/<part> shows all of that part's
// examples with their code.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToastProvider, AnchoredToastProvider } from "@/components/ui/toast";
import { examples } from "./examples.gen";
import type { Example } from "./types";

const parts = [...new Set(examples.map((e) => e.part))];
const byPart = (part: string) => examples.filter((e) => e.part === part);
const label = (part: string) => part.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

function store(key: string, fallback: string) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function keep(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private window: the choice lasts until reload */ }
}

function useRoute() {
  const read = () => decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [route, setRoute] = React.useState(read);
  React.useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return route;
}

declare global { interface Window { __kitErrors?: string[]; __kitRendered?: Set<string> } }

class Guard extends React.Component<{ name: string; children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  componentDidCatch(e: Error) { (window.__kitErrors ||= []).push(`${this.props.name}: ${e.message}`); }
  render() {
    if (this.state.error) return <p className="text-destructive-foreground text-sm">This example did not load: {this.state.error}</p>;
    return this.props.children;
  }
}

const cache = new Map<string, React.LazyExoticComponent<React.ComponentType>>();
function lazyOf(e: Example) {
  if (!cache.has(e.name)) cache.set(e.name, React.lazy(() => e.load().then((m) => { (window.__kitRendered ||= new Set()).add(e.name); return m; })));
  return cache.get(e.name)!;
}

function Code({ e }: { e: Example }) {
  const [text, setText] = React.useState<string | null>(null);
  React.useEffect(() => { e.source().then((m) => setText(m.default)); }, [e]);
  return (
    <pre className="max-h-96 overflow-auto rounded-b-xl border-t bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
      {text ?? "Loading the code"}
    </pre>
  );
}

function Preview({ e, link }: { e: Example; link?: boolean }) {
  const [code, setCode] = React.useState(false);
  const Comp = lazyOf(e);
  return (
    <section className="flex min-w-0 flex-col rounded-xl border bg-background shadow-xs/5" data-example={e.name}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        {link ? (
          <a className="font-medium text-sm hover:underline" href={`#/${e.part}`}>{label(e.part)}</a>
        ) : (
          <span className="text-muted-foreground text-xs">{e.name}</span>
        )}
        <div className="flex items-center gap-1">
          {link && <span className="text-muted-foreground text-xs">{byPart(e.part).length} examples</span>}
          {!link && <Button size="xs" variant="ghost" onClick={() => setCode((c) => !c)}>{code ? "Hide code" : "Code"}</Button>}
        </div>
      </div>
      <div className="flex min-h-48 min-w-0 flex-1 items-center justify-center overflow-x-auto p-6 sm:p-10">
        <Guard name={e.name}>
          <React.Suspense fallback={<span className="text-muted-foreground text-sm">Loading</span>}>
            <div className="flex w-full min-w-0 justify-center"><Comp /></div>
          </React.Suspense>
        </Guard>
      </div>
      {code && <Code e={e} />}
    </section>
  );
}

const swatches: [string, string, string][] = [
  ["canvas", "Canvas", "The page"], ["background", "Background", "Fields"], ["card", "Card", "Cards"], ["popover", "Popover", "Menus, dialogs"],
  ["foreground", "Foreground", "Main text"], ["muted-foreground", "Muted", "Quiet text"], ["primary", "Primary", "Main action"], ["brand", "Brand", "Needs Adrian"],
  ["border", "Border", "Edges"], ["input", "Input", "Field edges"], ["success", "Success", "Done, saved"], ["warning", "Warning", "Check this"],
  ["destructive", "Error", "Failed, delete"], ["info", "Info", "Neutral notice"],
];

function Overview() {
  return (
    <>
      <header className="mb-10">
        <h1 className="mb-2 font-heading font-bold text-3xl">Every part, one page</h1>
        <p className="text-lg text-muted-foreground">
          All {examples.length} of coss ui's examples, grouped by part, from coss's own code, in AR Create's colours. Pick a part to see every example and its code.
        </p>
      </header>
      <h2 className="mb-2 font-heading font-semibold text-2xl">Colours</h2>
      <p className="mb-4 text-muted-foreground">The only part that is AR Create's own. Dark is coss ui's dark, with AR Create's warm brand added.</p>
      <div className="mb-14 grid grid-cols-2 gap-3 rounded-xl border bg-background p-6 sm:grid-cols-4 lg:grid-cols-7">
        {swatches.map(([v, name, use]) => (
          <div key={v} className="flex flex-col gap-1 text-xs text-muted-foreground">
            <i className="mb-1 block h-14 rounded-lg shadow-[inset_0_0_0_1px_var(--border)]" style={{ background: `var(--${v})` }} />
            <b className="font-medium text-foreground text-sm">{name}</b>{use}
          </div>
        ))}
      </div>
      <h2 className="mb-2 font-heading font-semibold text-2xl">Parts</h2>
      <p className="mb-4 text-muted-foreground">The first example of each part.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {parts.map((p) => <Preview key={p} e={byPart(p)[0]} link />)}
      </div>
    </>
  );
}

function PartPage({ part }: { part: string }) {
  const list = byPart(part);
  return (
    <>
      <header className="mb-10">
        <a className="text-muted-foreground text-sm hover:text-foreground" href="#/">Every part</a>
        <h1 className="mt-2 mb-2 font-heading font-bold text-3xl">{label(part)}</h1>
        <p className="text-lg text-muted-foreground">{list.length} examples from coss ui, each with its code.</p>
      </header>
      <div className="flex flex-col gap-6">{list.map((e) => <Preview key={e.name} e={e} />)}</div>
    </>
  );
}

function Switch({ value, onChange, options, label: name }: { value: string; onChange: (v: string) => void; options: [string, string][]; label: string }) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(String(v))} aria-label={name}>
      <TabsList>{options.map(([v, l]) => <TabsTab key={v} value={v}>{l}</TabsTab>)}</TabsList>
    </Tabs>
  );
}

function App() {
  const route = useRoute();
  const [theme, setTheme] = React.useState(() => new URLSearchParams(location.search).get("theme") || store("ui-theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const [font, setFont] = React.useState(() => new URLSearchParams(location.search).get("font") || store("ui-font", "jakarta"));
  React.useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.classList.toggle("dark", theme === "dark"); keep("ui-theme", theme); }, [theme]);
  React.useEffect(() => { document.documentElement.dataset.font = font; keep("ui-font", font); }, [font]);
  const part = parts.includes(route) ? route : "";

  return (
    <div className="min-h-svh bg-canvas text-foreground">
      <header className="sticky top-0 z-20 flex min-h-15 flex-wrap items-center gap-x-4 gap-y-2 border-b bg-canvas px-4 py-2 sm:px-6">
        <a href="#/" className="whitespace-nowrap font-heading font-semibold text-lg">AR Create <span className="font-medium text-muted-foreground">parts</span></a>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="hidden text-muted-foreground text-xs md:inline">Font</span>
          <Switch label="Font" value={font} onChange={setFont} options={[["jakarta", "Plus Jakarta"], ["inter", "Inter"]]} />
          <Switch label="Theme" value={theme} onChange={setTheme} options={[["light", "Light"], ["dark", "Dark"]]} />
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
        <nav aria-label="Parts" className="border-b p-4 lg:sticky lg:top-15 lg:h-[calc(100svh-60px)] lg:overflow-auto lg:border-b-0">
          <p className="hidden h-7 items-center px-2 font-medium text-xs lg:flex">Overview</p>
          <ul className="mb-2 flex flex-wrap gap-0.5 lg:flex-col">
            <li><a href="#/" aria-current={part ? undefined : "page"} className="flex h-8 items-center rounded-lg px-2 text-muted-foreground text-sm hover:bg-accent hover:text-foreground aria-[current]:bg-accent aria-[current]:font-medium aria-[current]:text-foreground lg:pl-3.5">Every part</a></li>
          </ul>
          <p className="hidden h-7 items-center px-2 font-medium text-xs lg:flex">Parts</p>
          <ul className="flex flex-wrap gap-0.5 lg:flex-col">
            {parts.map((p) => (
              <li key={p}>
                <a href={`#/${p}`} aria-current={p === part ? "page" : undefined} className="flex h-8 items-center justify-between gap-2 rounded-lg px-2 text-muted-foreground text-sm hover:bg-accent hover:text-foreground aria-[current]:bg-accent aria-[current]:font-medium aria-[current]:text-foreground lg:pl-3.5">
                  {label(p)}<Badge variant="secondary" className="hidden lg:inline-flex">{byPart(p).length}</Badge>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 lg:pr-4 lg:pb-4">
          <main className="min-w-0 border-x-0 bg-card px-4 py-8 sm:px-8 sm:py-10 lg:rounded-b-2xl lg:border lg:border-t-0 lg:shadow-lg/5">
            <div className="mx-auto max-w-3xl">{part ? <PartPage part={part} /> : <Overview />}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <AnchoredToastProvider>
      <App />
    </AnchoredToastProvider>
  </ToastProvider>,
);
