import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/badge";
import { formatSignedPercent } from "@/lib/format-number";

/**
 * Today's change of an asset, as the Figma "Variación hoy" badge: green with an up arrow for a
 * gain, red with a down arrow for a loss, so the sign is not told by color alone. A change that
 * rounds to zero is neutral and has no arrow; an unknown change is a dash. A change between two
 * percentages is written in points (`-3.40 pp`), as the Figma does for a return. `solid` is the
 * filled look a price that just ticked takes for a moment.
 */
export function PriceChangeBadge({
  percent,
  points = false,
  solid = false,
}: {
  percent: number | null;
  points?: boolean;
  solid?: boolean;
}) {
  if (percent === null) return <span aria-hidden="true">—</span>;

  const signed = formatSignedPercent(percent);
  const text = points ? `${signed.slice(0, -1)} pp` : signed;
  const gain = text.startsWith("+");
  const loss = text.startsWith("-");
  const Arrow = gain ? ArrowUpRight : ArrowDownRight;

  return (
    <Badge style={solid ? "solid" : "subtle"} tone={gain ? "success" : loss ? "error" : "neutral"}>
      {gain || loss ? <Arrow aria-hidden="true" className="size-3.5" /> : null}
      {text}
    </Badge>
  );
}
