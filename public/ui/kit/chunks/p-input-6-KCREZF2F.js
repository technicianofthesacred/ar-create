import"./chunk-DCANE7XH.js";var t=`import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Particle() {
  const id = useId();
  return (
    <div className="flex flex-col items-start gap-2">
      <Label htmlFor={id}>Email</Label>
      <Input
        aria-label="Email"
        id={id}
        placeholder="you@example.com"
        type="email"
      />
    </div>
  );
}
`;export{t as default};
