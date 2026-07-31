import { describe, expect, it } from "vitest";
import { buildTrialLink, buildTrialMessage } from "@/features/landing/trial-link";
import type { LandingContact } from "@/features/landing/trial-link";

const EMPTY: LandingContact = {
  email: "",
  phone: "",
  line: "",
  whatsapp: "",
  facebook: "",
  address: ""
};

const SUBJECT = "Yummy-go trial";

describe("buildTrialLink", () => {
  it("uses LINE when only a LINE id is configured", () => {
    const link = buildTrialLink({ ...EMPTY, line: "@yummygo" }, "hello", SUBJECT);

    expect(link).toBe("https://line.me/R/oaMessage/%40yummygo/?hello");
  });

  it("prefers LINE over WhatsApp and email when several channels are configured", () => {
    const link = buildTrialLink(
      { ...EMPTY, line: "@yummygo", whatsapp: "8562012345678", email: "hi@yummy-go.com" },
      "hello",
      SUBJECT
    );

    expect(link).toBe("https://line.me/R/oaMessage/%40yummygo/?hello");
  });

  it("falls back to WhatsApp and keeps only digits from the configured number", () => {
    const link = buildTrialLink({ ...EMPTY, whatsapp: "+856 20 1234 5678" }, "hello", SUBJECT);

    expect(link).toBe("https://wa.me/8562012345678?text=hello");
  });

  it("falls back to mailto when email is the only channel", () => {
    const link = buildTrialLink({ ...EMPTY, email: "hi@yummy-go.com" }, "hello", SUBJECT);

    expect(link).toBe("mailto:hi@yummy-go.com?subject=Yummy-go%20trial&body=hello");
  });

  it("returns null when no channel is configured so the button can be disabled", () => {
    expect(buildTrialLink(EMPTY, "hello", SUBJECT)).toBeNull();
  });

  it("ignores channels that hold only whitespace", () => {
    expect(buildTrialLink({ ...EMPTY, line: "   ", email: "  " }, "hello", SUBJECT)).toBeNull();
  });

  it("encodes newlines, spaces, and Lao characters in the message", () => {
    const link = buildTrialLink({ ...EMPTY, whatsapp: "8562012345678" }, "ຊື່ຮ້ານ: A B\nສາຂາ: 2", SUBJECT);

    expect(link).toBe(
      "https://wa.me/8562012345678?text=%E0%BA%8A%E0%BA%B7%E0%BB%88%E0%BA%AE%E0%BB%89%E0%BA%B2%E0%BA%99%3A%20A%20B%0A%E0%BA%AA%E0%BA%B2%E0%BA%82%E0%BA%B2%3A%202"
    );
  });
});

describe("buildTrialMessage", () => {
  const labels = {
    intro: "ຂໍທົດລອງໃຊ້ Yummy-go",
    shopName: "ຊື່ຮ້ານ",
    contactName: "ຊື່ຜູ້ຕິດຕໍ່",
    phone: "ເບີໂທ",
    shopType: "ປະເພດຮ້ານ",
    branchCount: "ຈຳນວນສາຂາ"
  };

  it("puts every field on its own line under the intro", () => {
    const message = buildTrialMessage(
      {
        shopName: "ຮ້ານທົດສອບ",
        contactName: "ສີລາວົງ",
        phone: "02012345678",
        shopType: "ຮ້ານອາຫານ",
        branchCount: "2"
      },
      labels
    );

    expect(message).toBe(
      [
        "ຂໍທົດລອງໃຊ້ Yummy-go",
        "ຊື່ຮ້ານ: ຮ້ານທົດສອບ",
        "ຊື່ຜູ້ຕິດຕໍ່: ສີລາວົງ",
        "ເບີໂທ: 02012345678",
        "ປະເພດຮ້ານ: ຮ້ານອາຫານ",
        "ຈຳນວນສາຂາ: 2"
      ].join("\n")
    );
  });
});
