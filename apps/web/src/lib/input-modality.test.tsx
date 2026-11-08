import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { trackInputModality } from "./input-modality";

const modality = () => document.documentElement.getAttribute("data-input-modality");

describe("trackInputModality", () => {
  let stop: () => void;

  beforeEach(() => {
    stop = trackInputModality();
  });

  afterEach(() => {
    stop();
  });

  it("starts as pointer", () => {
    expect(modality()).toBe("pointer");
  });

  it("switches to keyboard on Tab and back to pointer on the next press", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(modality()).toBe("keyboard");

    document.dispatchEvent(new Event("pointerdown"));
    expect(modality()).toBe("pointer");
  });

  it("ignores other keys, so typing after a click keeps the ring off", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(modality()).toBe("pointer");
  });

  it("removes the attribute and the listeners when stopped", () => {
    stop();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(modality()).toBeNull();
  });
});
