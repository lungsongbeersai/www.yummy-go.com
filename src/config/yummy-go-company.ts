import appVersion from "../../public/app-version.json";

export interface YummyGoCompany {
  name: string;
  logo: string;
  phone: string;
  address: string;
  website: string;
  facebook: string;
  whatsappUrl: string;
  appStoreUrl: string;
  googlePlayUrl: string;
}

const phone = "020 99 177 793";
const internationalPhone = `856${phone.replace(/\D/g, "").replace(/^0/, "")}`;

export const YUMMY_GO_COMPANY: YummyGoCompany = {
  name: "YummyGo",
  logo: "/brand/icon-mark.png",
  phone,
  address: "",
  website: "https://yummy-go.com",
  facebook: "https://www.facebook.com/share/1H8L4DMjtd/",
  whatsappUrl: `https://wa.me/${internationalPhone}`,
  appStoreUrl: appVersion.ios.storeUrl,
  googlePlayUrl: appVersion.android.storeUrl,
};
