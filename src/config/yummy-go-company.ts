export interface YummyGoCompany {
  name: string;
  logo: string;
  phone: string;
  address: string;
  website: string;
  facebook: string;
  whatsappUrl: string;
}

const phone = "020 52 222 795";
const internationalPhone = `856${phone.replace(/\D/g, "").replace(/^0/, "")}`;

export const YUMMY_GO_COMPANY: YummyGoCompany = {
  name: "YummyGo",
  logo: "/brand/icon-mark.png",
  phone,
  address: "",
  website: "https://yummy-go.com",
  facebook: "https://www.facebook.com/share/1H8L4DMjtd/",
  whatsappUrl: `https://wa.me/${internationalPhone}`
};
