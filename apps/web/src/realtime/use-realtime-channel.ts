import { channelName, type RealtimeChannel, type RealtimeEvent } from "@trading/contracts";
import { useEffect, useEffectEvent } from "react";
import { useRealtimeClient } from "./realtime-client-provider";

/**
 * Listens to one channel while the component is mounted. The subscription follows the channel by
 * its name, not by the object, so passing a new object on each render does not subscribe again;
 * and it always calls the latest `onEvent`, so that function does not need to be memoized.
 */
export function useRealtimeChannel(
  channel: RealtimeChannel,
  onEvent: (event: RealtimeEvent) => void,
): void {
  const client = useRealtimeClient();
  const name = channelName(channel);
  const handleEvent = useEffectEvent(onEvent);
  const subscribe = useEffectEvent(() => client.subscribe(channel, handleEvent));

  useEffect(() => subscribe(), [client, name]);
}
