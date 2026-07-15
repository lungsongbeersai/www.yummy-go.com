import { describe, expect, it } from "vitest";
import { createParticleStyles } from "@/features/landing/landing-particles";

describe("createParticleStyles", () => {
  it("creates the same particle styles on every render", () => {
    const styles = createParticleStyles();

    expect(styles).toHaveLength(22);
    expect(createParticleStyles()).toEqual(styles);
  });

  it("limits CSS precision so browser normalization cannot change hydration values", () => {
    const styles = createParticleStyles();

    expect(styles[15]).toEqual({
      left: "83.0351%",
      top: "0.9351%",
      width: "3.7322px",
      height: "3.7322px",
      opacity: 0.6235,
      animationDuration: "16.2799s",
      animationDelay: "-9.4363s"
    });
  });
});
