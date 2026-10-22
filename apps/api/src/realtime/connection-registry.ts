/** The authenticated connections of the process, indexed by user (ADR-005 point 13). */
export interface ConnectionRegistry<C extends { readonly userId: string }> {
  add: (connection: C) => void;
  remove: (connection: C) => void;
  countOf: (userId: string) => number;
  size: () => number;
}

export function createConnectionRegistry<
  C extends { readonly userId: string },
>(): ConnectionRegistry<C> {
  const byUser = new Map<string, Set<C>>();

  return {
    add(connection) {
      const connections = byUser.get(connection.userId) ?? new Set<C>();
      connections.add(connection);
      byUser.set(connection.userId, connections);
    },

    remove(connection) {
      const connections = byUser.get(connection.userId);
      connections?.delete(connection);
      if (connections?.size === 0) {
        byUser.delete(connection.userId);
      }
    },

    countOf: (userId) => byUser.get(userId)?.size ?? 0,

    size() {
      let total = 0;
      for (const connections of byUser.values()) {
        total += connections.size;
      }
      return total;
    },
  };
}
