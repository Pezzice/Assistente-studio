import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "it.assistentestudio.app",
  appName: "Assistente studio",
  webDir: "mobile/dist",
  plugins: {
    // Native HTTP: requests to ClasseViva leave from the phone, without browser CORS limits
    CapacitorHttp: { enabled: true },
  },
};

export default config;
