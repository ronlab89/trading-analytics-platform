import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/badge";
import { formatSignedPercent } from "@/lib/format-number";

/**
 * Today's change of an asset, as the Figma "Variación hoy" badge: green with an up arrow for a
 * gain, red with a down arrow for a loss, so the sign is not told by color alone. A change that
 * rounds to zero is neutral and has no arrow; an unknown change is a dash.
 */
export function PriceChangeBadge({ percent }: { percent: number | null }) {
  if (percent === null) return <span aria-hidden="true">—</span>;

  const text = formatSignedPercent(percent);
  const gain = text.startsWith("+");
  const loss = text.startsWith("-");
  const Arrow = gain ? ArrowUpRight : ArrowDownRight;

  return (
    <Badge tone={gain ? "success" : loss ? "error" : "neutral"}>
      {gain || loss ? <Arrow aria-hidden="true" className="size-3.5" /> : null}
      {text}
    </Badge>
  );
}
