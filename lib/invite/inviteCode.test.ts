import { generateInviteCode } from "./inviteCode";

describe("generateInviteCode", () => {
  it("matches the XXX-XXXX-XX shape using only unambiguous characters", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/);
  });

  it("can produce different values across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
