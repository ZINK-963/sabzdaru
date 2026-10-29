import { describe, it, expect } from "vitest";

import { ALLOWED_TRANSITIONS } from "../lib/order-transitions";

const ALL_STATUSES = Object.keys(ALLOWED_TRANSITIONS);

describe("order status transition table", () => {
  it("every status referenced as a target also exists as a source key", () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const target of targets) {
        expect(ALL_STATUSES).toContain(target);
      }
    }
  });

  it("terminal states (CANCELLED, REFUNDED) have no outgoing transitions", () => {
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.REFUNDED).toEqual([]);
  });

  it("cannot jump straight from PENDING_PAYMENT to DELIVERED", () => {
    expect(ALLOWED_TRANSITIONS.PENDING_PAYMENT).not.toContain("DELIVERED");
  });

  it("every non-terminal state has at least one way out", () => {
    for (const [status, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      if (status === "CANCELLED" || status === "REFUNDED") continue;
      expect(targets.length).toBeGreaterThan(0);
    }
  });

  it("REFUNDED is reachable from PAID and from RETURNED", () => {
    expect(ALLOWED_TRANSITIONS.PAID).toContain("REFUNDED");
    expect(ALLOWED_TRANSITIONS.RETURNED).toContain("REFUNDED");
  });
});
