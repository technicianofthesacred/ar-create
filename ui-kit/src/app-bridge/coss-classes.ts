// coss ui's own style rules (from the installed parts in src/components/ui) for AR Create's plain-script screens.
// Built into public/ui/kit/coss-classes.js and loaded by version three, it gives `window.coss`:
//   coss.button({ variant, size })  coss.badge({ variant, size })  coss.toggle({ variant, size })
//   coss.select({ size })  coss.group({ orientation })  coss.cn(...classes)
// Each returns the exact class list coss's React part would put on the element. Elements that use them also carry
// the class "coss", which the app's older control styles leave alone.
import { buttonVariants } from "@/components/ui/button";
import { badgeVariants } from "@/components/ui/badge";
import { toggleVariants } from "@/components/ui/toggle";
import { selectTriggerVariants } from "@/components/ui/select";
import { groupVariants } from "@/components/ui/group";
import { cn } from "@/lib/utils";

const tag = (classes: string) => cn("coss", classes);

(window as unknown as { coss: unknown }).coss = {
  button: (o: Parameters<typeof buttonVariants>[0] = {}) => tag(buttonVariants(o)),
  badge: (o: Parameters<typeof badgeVariants>[0] = {}) => tag(badgeVariants(o)),
  toggle: (o: Parameters<typeof toggleVariants>[0] = {}) => tag(toggleVariants(o)),
  select: (o: Parameters<typeof selectTriggerVariants>[0] = {}) => tag(selectTriggerVariants(o)),
  group: (o: Parameters<typeof groupVariants>[0] = {}) => tag(groupVariants(o)),
  cn,
};
