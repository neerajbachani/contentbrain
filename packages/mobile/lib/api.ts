import { hc } from "hono/client";
import type { AppType } from "@template/web";
import { getToken } from "./auth";
import { getApiBase } from "./apiBase";

const baseUrl = getApiBase();

const client = hc<AppType>(baseUrl!, {
  headers: () => {
    const token = getToken();
    return { Authorization: token ?? "" };
  },
});

export const api = client.api;
