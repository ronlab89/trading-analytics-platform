import { describe, expect, it } from "vitest";
import { NotificationSeverity } from "./enums";
import { InvalidNotificationError, validateNewNotification } from "./notification";

const baseInput = {
  userId: "user_001",
  type: "transaction.completed",
  title: "Transaction completed",
  message: "Your buy order for AAPL was completed.",
  severity: NotificationSeverity.SUCCESS,
};

describe("validateNewNotification", () => {
  it("should accept a valid notification input", () => {
    expect(() => {
      validateNewNotification(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing userId", () => {
    expect(() => {
      validateNewNotification({ ...baseInput, userId: "" });
    }).toThrow(InvalidNotificationError);
  });

  it("should reject a missing type", () => {
    expect(() => {
      validateNewNotification({ ...baseInput, type: "" });
    }).toThrow(InvalidNotificationError);
  });

  it("should reject a missing title", () => {
    expect(() => {
      validateNewNotification({ ...baseInput, title: "" });
    }).toThrow(InvalidNotificationError);
  });

  it("should reject a missing message", () => {
    expect(() => {
      validateNewNotification({ ...baseInput, message: "" });
    }).toThrow(InvalidNotificationError);
  });
});
