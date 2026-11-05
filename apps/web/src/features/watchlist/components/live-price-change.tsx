import type { MoneyDto } from "@trading/contracts";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { useTickFlash } from "@/hooks/use-tick-flash";
import { useConnectionState } from "@/realtime/realtime-client-provider";
import { PriceChangeBadge } from "./price-change-badge";

interface LivePriceChangeProps {
  assetId: string;
  price: MoneyDto | null;
  percent: number | null;
}

/**
 * The change of a price that ticks: the usual badge, solid for a second after the price or the
 * change moves (FE3.0 §1). The arrow and the sign are still in the text, so the flash is never the
 * only sign, and with reduced motion it does not happen at all. While the connection is lost the
 * price is the last one received, and a warning badge with a clock says it is paused instead.
 */
export function LivePriceChange({ assetId, price, percent }: LivePriceChangeProps) {
  const { t } = useTranslation();
  const state = useConnectionState();
  const flashing = useTickFlash(assetId, `${price?.amount ?? ""}|${String(percent)}`);

  if (state === "reconnecting" || state === "failed") {
    return (
      <Badge tone="warning">
        <Clock aria-hidden="true" className="size-3.5" />
        {t("markets.pricesPaused")}
      </Badge>
    );
  }
  return <PriceChangeBadge percent={percent} solid={flashing} />;
}
