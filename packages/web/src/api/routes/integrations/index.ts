import { Hono } from "hono";
import { xaiIntegrationRoute } from "./xai";

export const integrationsRoute = new Hono().route("/xai", xaiIntegrationRoute);
