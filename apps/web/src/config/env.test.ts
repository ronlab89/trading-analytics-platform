import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("falls back to the local API and its WebSocket when nothing is set", () => {
    expect(parseEnv({})).toEqual({
      VITE_APP_MODE: "real",
      VITE_API_BASE_URL: "http://localhost:7001",
      VITE_WS_URL: "ws://localhost:7001/ws",
    });
  });

  it("takes the WebSocket address from VITE_WS_URL, secure or not", () => {
    expect(parseEnv({ VITE_WS_URL: "wss://api.example.com/ws" }).VITE_WS_URL).toBe(
      "wss://api.example.com/ws",
    );
    expect(parseEnv({ VITE_WS_URL: "ws://localhost:9000/ws" }).VITE_WS_URL).toBe(
      "ws://localhost:9000/ws",
    );
  });

  it.each(["not a url", "http://localhost:7001/ws", "https://api.example.com/ws"])(
    "refuses %s as the WebSocket address, naming the key and not the value",
    (value) => {
      expect(() => parseEnv({ VITE_WS_URL: value })).toThrow(
        "Invalid web environment: VITE_WS_URL",
      );
      expect(() => parseEnv({ VITE_WS_URL: value })).not.toThrow(value);
    },
  );

  it("keeps validating the keys it already had", () => {
    expect(() => parseEnv({ VITE_APP_MODE: "other" })).toThrow(
      "Invalid web environment: VITE_APP_MODE",
    );
    expect(() => parseEnv({ VITE_API_BASE_URL: "nope" })).toThrow(
      "Invalid web environment: VITE_API_BASE_URL",
    );
  });
});
