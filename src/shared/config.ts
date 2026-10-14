export type PublicConfig = {
  environment: "development" | "stagging" | "production";
  siteUrl: string;
  apiUrl: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
    messagingSenderId: string;
  };
  sentryDsn: string;
  release: string;
  supportEmail: string;
};
export const fallbackConfig: PublicConfig = {
  environment: "development",
  siteUrl: "http://127.0.0.1:5173",
  apiUrl: "",
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    appId: "",
    messagingSenderId: "",
  },
  sentryDsn: "",
  release: "local",
  supportEmail: "",
};
declare global {
  interface Window {
    __CONFIG__?: PublicConfig;
    __PAGE__?: { path: string; profile?: import("./domain").Profile };
  }
}
