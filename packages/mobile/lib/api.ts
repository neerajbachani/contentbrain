import { hc } from "hono/client";
import { getApiAuthHeaders } from "./auth";
import { getApiBase } from "./apiBase";

const client = hc(getApiBase(), {
  headers: () => getApiAuthHeaders(),
});

export const api = client.api;
