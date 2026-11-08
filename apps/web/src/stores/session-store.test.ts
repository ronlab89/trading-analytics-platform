import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore, watchAccessToken } from "./session-store";

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
});

describe("watchAccessToken", () => {
  it("tells when the token is renewed and when it is removed", () => {
    useSessionStore.setState({ accessToken: "old" });
    const onChange = vi.fn();
    watchAccessToken(onChange);

    useSessionStore.setState({ accessToken: "new" });
    expect(onChange).toHaveBeenCalledTimes(1);

    useSessionStore.getState().signOut();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("stays quiet when something else in the session changes", () => {
    useSessionStore.setState({ accessToken: "same" });
    const onChange = vi.fn();
    watchAccessToken(onChange);

    useSessionStore.setState({ expired: true });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("stops telling once the returned function is called", () => {
    const onChange = vi.fn();
    const stop = watchAccessToken(onChange);

    stop();
    useSessionStore.setState({ accessToken: "new" });

    expect(onChange).not.toHaveBeenCalled();
  });
});
