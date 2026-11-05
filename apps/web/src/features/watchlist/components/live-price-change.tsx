import type { MoneyDto } from "@trading/contracts";
import { useTickFlash } from "@/hooks/use-tick-flash";
import { PriceChangeBadge } from "./price-change-badge";

interface LivePriceChangeProps {
  assetId: string;
  price: MoneyDto | null;
  percent: number | null;
}

/**
 * The change of a price that ticks: the usual badge, solid for a second after the price or the
 * change moves (FE3.0 §1). The arrow and the sign are still in the text, so the flash is never the
 * only sign, and with reduced motion it does not happen at all.
 */
export function LivePriceChange({ assetId, price, percent }: LivePriceChangeProps) {
  const flashing = useTickFlash(assetId, `${price?.amount ?? ""}|${String(percent)}`);
  return <PriceChangeBadge percent={percent} solid={flashing} />;
}
