import type { Clock } from "@trading/application";
import { NOTIFICATIONS_CHANNEL, presentTimestamp } from "@trading/contracts";
import type { RealtimeEventType } from "@trading/contracts";

/** What the hub needs of a socket: who it belongs to and how to write to it. */
export interface HubSubscriber {
  readonly userId: string;
  /** Sends a JSON message; false when the socket is closed or the send closed it. */
  send: (message: unknown) => boolean;
}

/** An event to deliver. `userId` is the owner of the `notifications` channel it goes to. */
export interface HubEvent {
  readonly type: RealtimeEventType;
  readonly channel: string;
  readonly payload: unknown;
  readonly userId?: string;
}

export interface RealtimeHubOptions {
  clock: Clock;
  newId: () => string;
  /** Identifies this process run: `sequence` restarts with the process, so a client resets on a new epoch. */
  epoch: string;
}

/**
 * Delivery of events to the subscribed sockets (ADR-007 points 5 and 17).
 *
 * Each channel has its own `sequence`, starting at 1 and rising by one for every
 * event that is delivered, so a client can see a gap. The `notifications`
 * channel is per user: two users on it have independent sequences and never
 * see each other's events. Publishing is synchronous, so events of one channel
 * reach a socket in the order they were published, and a socket that fails to
 * accept one never delays or stops the others.
 */
export interface RealtimeHub {
  /** Adds the subscription; false when the socket already had it. */
  subscribe: (subscriber: HubSubscriber, channel: string) => boolean;
  /** Drops the subscription; false when the socket did not have it. */
  unsubscribe: (subscriber: HubSubscriber, channel: string) => boolean;
  /** The channel names the socket is subscribed to. */
  channelsOf: (subscriber: HubSubscriber) => readonly string[];
  /** Drops every subscription of a socket, when it closes. */
  remove: (subscriber: HubSubscriber) => void;
  /** Delivers the event to the sockets subscribed to its channel. */
  publish: (event: HubEvent) => void;
}

export function createRealtimeHub(options: RealtimeHubOptions): RealtimeHub {
  const { clock, newId, epoch } = options;
  const channelsBySubscriber = new Map<HubSubscriber, Set<string>>();
  const subscribersByTopic = new Map<string, Set<HubSubscriber>>();
  const sequenceByTopic = new Map<string, number>();

  /** The key sockets share: `notifications` is scoped to its user, every other channel is global. */
  function topicOf(channel: string, userId: string): string {
    return channel === NOTIFICATIONS_CHANNEL ? `${NOTIFICATIONS_CHANNEL}|${userId}` : channel;
  }

  const hub: RealtimeHub = {
    subscribe(subscriber, channel) {
      const channels = channelsBySubscriber.get(subscriber) ?? new Set<string>();

      if (channels.has(channel)) {
        return false;
      }

      channels.add(channel);
      channelsBySubscriber.set(subscriber, channels);

      const topic = topicOf(channel, subscriber.userId);
      const subscribers = subscribersByTopic.get(topic) ?? new Set<HubSubscriber>();
      subscribers.add(subscriber);
      subscribersByTopic.set(topic, subscribers);

      return true;
    },

    unsubscribe(subscriber, channel) {
      const channels = channelsBySubscriber.get(subscriber);

      if (!channels?.delete(channel)) {
        return false;
      }

      if (channels.size === 0) {
        channelsBySubscriber.delete(subscriber);
      }

      const topic = topicOf(channel, subscriber.userId);
      const subscribers = subscribersByTopic.get(topic);
      subscribers?.delete(subscriber);

      if (subscribers?.size === 0) {
        subscribersByTopic.delete(topic);
      }

      return true;
    },

    channelsOf: (subscriber) => [...(channelsBySubscriber.get(subscriber) ?? [])],

    remove(subscriber) {
      for (const channel of hub.channelsOf(subscriber)) {
        hub.unsubscribe(subscriber, channel);
      }
    },

    publish(event) {
      const topic =
        event.channel === NOTIFICATIONS_CHANNEL
          ? event.userId === undefined
            ? undefined
            : topicOf(event.channel, event.userId)
          : event.channel;
      const subscribers = topic === undefined ? undefined : subscribersByTopic.get(topic);

      if (topic === undefined || subscribers === undefined) {
        return;
      }

      const sequence = (sequenceByTopic.get(topic) ?? 0) + 1;
      sequenceByTopic.set(topic, sequence);

      const message = {
        id: newId(),
        type: event.type,
        channel: event.channel,
        sequence,
        timestamp: presentTimestamp(clock.now()),
        epoch,
        payload: event.payload,
      };

      // A copy, so a socket that closes during delivery cannot disturb the loop.
      for (const subscriber of [...subscribers]) {
        try {
          subscriber.send(message);
        } catch {
          // One failing socket never stops the delivery to the others.
        }
      }
    },
  };

  return hub;
}
