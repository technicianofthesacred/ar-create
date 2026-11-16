import"./chunk-DCANE7XH.js";var t=`"use client";

import { Slider } from "@/components/ui/slider";

export default function Particle() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Slider
        getAriaLabel={(index) =>
          index === 0 ? "Minimum value" : "Maximum value"
        }
        defaultValue={[25, 75]}
        orientation="vertical"
      />
    </div>
  );
}
`;export{t as default};
