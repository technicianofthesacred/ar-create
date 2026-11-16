import type * as React from "react";

export interface Example {
  part: string;
  n: number;
  name: string;
  load: () => Promise<{ default: React.ComponentType }>;
  source: () => Promise<{ default: string }>;
}
