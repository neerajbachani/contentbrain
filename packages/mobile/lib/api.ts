import { hc } from "hono/client";
import { getToken } from "./auth";
import { getApiBase } from "./apiBase";

const client = hc(getApiBase(), {
  headers: () => {
    const token = getToken();
    return { Authorization: token ?? "" };
  },
});

export const api = client.api;
