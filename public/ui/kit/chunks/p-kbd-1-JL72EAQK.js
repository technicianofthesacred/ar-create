import"./chunk-DCANE7XH.js";var K=`import { Kbd, KbdGroup } from "@/components/ui/kbd";

export default function Particle() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-muted-foreground text-sm">Single keys:</p>
        <div className="flex gap-2">
          <Kbd>K</Kbd>
          <Kbd>\u2318</Kbd>
          <Kbd>\u2303</Kbd>
          <Kbd>\u21E7</Kbd>
        </div>
      </div>
      <div>
        <p className="mb-2 text-muted-foreground text-sm">Key combinations:</p>
        <div className="flex gap-2">
          <KbdGroup>
            <Kbd>\u2318</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
          <KbdGroup>
            <Kbd>\u2318</Kbd>
            <Kbd>Shift</Kbd>
            <Kbd>P</Kbd>
          </KbdGroup>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>Alt</Kbd>
            <Kbd>Delete</Kbd>
          </KbdGroup>
        </div>
      </div>
    </div>
  );
}
`;export{K as default};
