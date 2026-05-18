declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PACKAGER_PROXY_URL?: string;
    WEBSITE_URL?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};

