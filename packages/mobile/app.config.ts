import { config } from "dotenv";
import { resolve } from "path";
import type { ExpoConfig, ConfigContext } from "expo/config";

// Load monorepo root .env so mobile shares one file with the web/API package.
config({ path: resolve(__dirname, "../../.env") });

import appJson from "./app.json";

export default ({ config: _ctx }: ConfigContext): ExpoConfig => {
  const base = appJson.expo as ExpoConfig;
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
    base.extra?.apiUrl?.replace(/\/$/, "") ||
    "http://localhost:5173";

  return {
    ...base,
    extra: {
      ...base.extra,
      apiUrl,
    },
  };
};
