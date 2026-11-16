// coss ui's examples are written for Next.js and 16 of them import next/link. Outside Next.js the link is a plain
// anchor; the build points next/link here.
import * as React from "react";

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string | { pathname?: string }; prefetch?: boolean; replace?: boolean; scroll?: boolean };

const Link = React.forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch: _p, replace: _r, scroll: _s, ...rest }, ref) {
  const to = typeof href === "string" ? href : href.pathname ?? "#";
  return <a ref={ref} href={to} {...rest} />;
});

export default Link;
