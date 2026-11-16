// A live mock of two AR Create screens (version three's Home and a subject page) rebuilt from coss ui's parts, in
// AR Create's own colours. The words and layout copy the demo app; only the controls change. Nothing here talks to
// the app: it exists so Adrian can click, hover and compare before any screen is rebuilt.
import * as React from "react";
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, EllipsisIcon, GripVerticalIcon, PinIcon, PlusIcon, SearchIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";

function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

function Band({ place }: { place: string }) {
  return (
    <div className="flex h-12 items-center gap-2 border-b bg-sidebar px-4">
      <a href="#/mock/home" aria-label="Home" className="mr-1 grid size-8 place-items-center rounded-lg"><i className="block size-4.5 rounded-md bg-foreground" /></a>
      <Tabs value={place} aria-label="Places">
        <TabsList variant="underline">
          {["Home", "Research", "Looks", "Library"].map((p) => <TabsTab key={p} value={p}>{p}</TabsTab>)}
        </TabsList>
      </Tabs>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm"><SearchIcon />Find <Kbd>⌘K</Kbd></Button>
        <Button variant="ghost" size="sm"><PlusIcon />Capture</Button>
        <Tip label="Switch to light"><Button variant="ghost" size="icon-sm" aria-label="Switch to light"><SunIcon /></Button></Tip>
        <Button variant="ghost" size="sm">Version two</Button>
        <Button variant="ghost" size="sm">Advanced</Button>
      </div>
    </div>
  );
}

const subjects = [
  ["Bamboo Carver", "Research", "The facts", false],
  ["Synthetic Second Article", "Gather", "", false],
  ["Synthetic Working Article", "Gather", "", false],
  ["The Loom Beside the Water", "Create", "Check", true],
  ["Where the Ash Settles", "Create", "Check", false],
] as const;

function Row({ title, station, step, link }: { title: string; station: string; step: string; link: boolean }) {
  return (
    <div className="group flex h-11 items-center gap-3 border-t px-3 text-sm first:border-t-0 hover:bg-accent/60">
      <GripVerticalIcon className="size-4 shrink-0 cursor-grab text-muted-foreground/60" aria-hidden />
      <i className="block size-6 shrink-0 rounded-md bg-muted shadow-[inset_0_0_0_1px_var(--border)]" />
      <a href={link ? "#/mock/subject" : "#/mock/home"} className="min-w-0 flex-1 truncate font-medium hover:underline">{title}</a>
      <span className="hidden w-28 items-center gap-1.5 text-muted-foreground sm:flex"><Spinner className="size-3.5" />{station}</span>
      <span className="hidden w-24 text-muted-foreground sm:block">{step}</span>
      <span className="text-muted-foreground text-xs">Today</span>
      <div className="flex items-center opacity-60 transition-opacity group-hover:opacity-100">
        <Tip label="Move up"><Button variant="ghost" size="icon-xs" aria-label="Move up"><ArrowUpIcon /></Button></Tip>
        <Tip label="Move down"><Button variant="ghost" size="icon-xs" aria-label="Move down"><ArrowDownIcon /></Button></Tip>
        <Menu>
          <MenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="More" />}><EllipsisIcon /></MenuTrigger>
          <MenuPopup align="end">
            <MenuItem>Open</MenuItem>
            <MenuItem>Rename</MenuItem>
            <MenuItem>Move to a folder</MenuItem>
            <MenuItem>Put on your desk</MenuItem>
            <MenuSeparator />
            <MenuItem variant="destructive">Let it rest</MenuItem>
          </MenuPopup>
        </Menu>
        <Tip label="Pin to your desk"><Button variant="ghost" size="icon-xs" aria-label="Pin"><PinIcon /></Button></Tip>
      </div>
    </div>
  );
}

function Home() {
  const [view, setView] = React.useState<string[]>(["rows"]);
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div><h1 className="font-heading font-semibold text-base">Home</h1><p className="text-muted-foreground text-sm">Monday 16 Nov 2026</p></div>
        <Button onClick={() => toastManager.add({ title: "New subject", description: "Name it to begin." })}><PlusIcon />New subject</Button>
      </div>
      <h2 className="mb-1 font-medium text-sm">On your desk</h2>
      <p className="mb-8 text-muted-foreground text-sm">Nothing on your desk yet.</p>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-sm">Everything <span className="ml-1 font-normal text-muted-foreground text-xs">5 subjects</span></p>
        <InputGroup className="w-56">
          <InputGroupInput aria-label="Find a subject" placeholder="Find a subject" type="search" />
          <InputGroupAddon><SearchIcon aria-hidden /></InputGroupAddon>
        </InputGroup>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Tabs defaultValue="folder" aria-label="Group by">
          <TabsList variant="underline">
            <TabsTab value="folder">By folder</TabsTab><TabsTab value="tag">By tag</TabsTab><TabsTab value="station">By station</TabsTab><TabsTab value="recent">Recent</TabsTab>
          </TabsList>
        </Tabs>
        <Tabs defaultValue="all" aria-label="Station">
          <TabsList>
            <TabsTab value="all">All</TabsTab>
            {[["Gather", 2], ["Research", 1], ["Create", 2], ["Share", 0], ["Published", 0], ["Resting", 0]].map(([s, n]) => (
              <TabsTab key={s} value={String(s)}>{s}<Badge variant="secondary" size="sm">{n}</Badge></TabsTab>
            ))}
          </TabsList>
        </Tabs>
        <ToggleGroup className="ml-auto" variant="outline" size="sm" value={view} onValueChange={(v) => v.length && setView(v as string[])}>
          <ToggleGroupItem value="rows">Rows</ToggleGroupItem>
          <ToggleGroupItem value="covers">Covers</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Frame>
        <FrameHeader><FrameTitle>Not in a folder <span className="ml-1 font-normal text-muted-foreground">5</span></FrameTitle></FrameHeader>
        <FramePanel className="p-0">
          {subjects.map(([t, s, st, link]) => <Row key={t} title={t} station={s} step={st} link={link} />)}
        </FramePanel>
      </Frame>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline" size="sm"><PlusIcon />New folder</Button>
        <p className="text-muted-foreground text-xs">Folders here are the real folders on disk. Drag a folder to change the order, or a subject onto a folder to move it.</p>
      </div>
    </div>
  );
}

const steps: [string, string, string, "done" | "now" | "todo"][] = [
  ["Gather", "What you have", "2 written sources. This story's material is kept in the Magazine.", "done"],
  ["Research", "The facts", "No research file is on record for this story.", "todo"],
  ["Simmer", "Name the dish", "Not said yet.", "todo"],
  ["Create", "The words", "", "done"],
  ["Create", "Photographs in the article", "No photographs added yet.", "todo"],
  ["Create", "Check", "Not checked yet.", "now"],
  ["Share", "Your yes", "", "todo"],
  ["Share", "Publish", "", "todo"],
];

const looks = [{ label: "Choose a look", value: "" }, { label: "Teajia magazine", value: "teajia" }, { label: "Mandala Codes", value: "mandala" }, { label: "Plain", value: "plain" }];

function Subject() {
  const [current, setCurrent] = React.useState("Check");
  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="font-heading font-semibold text-xl">The Loom Beside the Water</h1>
        <Select defaultValue="" items={looks}>
          <SelectTrigger size="sm" className="w-auto min-w-36" aria-label="Choose a look"><SelectValue /></SelectTrigger>
          <SelectPopup>{looks.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectPopup>
        </Select>
        <a href="#/mock/home" className="text-muted-foreground text-sm hover:text-foreground">Subjects</a>
        <span className="ml-auto text-muted-foreground text-sm">No direction yet</span>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
        <span>2 notes</span><span>79 words</span><span>2 of 8 steps done</span>
        <Button variant="link" size="sm" className="px-0 text-brand">Next: Check<ArrowRightIcon /></Button>
      </div>
      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Steps" className="flex flex-col gap-0.5">
          <Button variant="outline" size="sm" className="mb-3 justify-start">Article <span className="text-muted-foreground">the magazine</span><Badge variant="secondary" size="sm" className="ml-auto">2/8</Badge></Button>
          {steps.map(([group, name, , state], i) => (
            <React.Fragment key={name}>
              {(i === 0 || steps[i - 1][0] !== group) && <p className="mt-2 px-2 text-muted-foreground text-xs">{group}</p>}
              <button type="button" onClick={() => setCurrent(name)} aria-current={current === name ? "step" : undefined}
                className="flex h-8 items-center gap-2 rounded-lg px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-[current]:bg-accent aria-[current]:font-medium aria-[current]:text-foreground">
                <i className={`block size-2.5 shrink-0 rounded-full ${state === "done" ? "bg-foreground/80" : state === "now" ? "bg-brand" : "border border-muted-foreground/60"}`} />
                {name}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="flex flex-col gap-4">
          {steps.slice(0, 5).map(([group, name, desc]) => (
            <Card key={name} className={current === name ? "ring-1 ring-brand/50" : ""}>
              <CardHeader>
                <p className="text-muted-foreground text-xs">{group}</p>
                <CardTitle className="text-base">{name}</CardTitle>
                {desc && <CardDescription>{desc}</CardDescription>}
              </CardHeader>
              <CardPanel className="flex flex-wrap gap-2 pt-0">
                {name === "Name the dish" && <Button variant="secondary" size="sm" onClick={() => toastManager.add({ title: "Write the dish", description: "Say it in your own words." })}>Write it</Button>}
                {name === "The words" && <><Button size="sm">Write<ArrowRightIcon /></Button><Button variant="outline" size="sm">Read it through</Button></>}
                {name !== "The words" && name !== "Name the dish" && <Button variant="ghost" size="sm" className="text-muted-foreground">Open the Magazine</Button>}
              </CardPanel>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Mock({ which }: { which: string }) {
  return (
    <div className="min-h-[calc(100svh-60px)] bg-canvas">
      <Band place={which === "subject" ? "Home" : "Home"} />
      {which === "subject" ? <Subject /> : <Home />}
    </div>
  );
}
