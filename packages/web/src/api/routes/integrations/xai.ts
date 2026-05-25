import { Hono } from "hono";

import { requireAuth } from "../../middleware/auth";

import {

  deleteUserXaiCredentials,

  hasUserXaiCredentials,

  saveUserXaiCredentials,

} from "../../services/x/credentials";

import { clearUserXContextCache } from "../../services/x/contextCache";

import { extractXaiAccessTokenFromPaste } from "../../services/x/extractToken";

import { logXContext } from "../../services/x/logger";

import { probeXaiToken } from "../../services/x/xSearchContext";



export const xaiIntegrationRoute = new Hono()

  .get("/status", requireAuth, async (c) => {

    const user = c.get("user")!;

    const connected = await hasUserXaiCredentials(user.id);

    return c.json({ connected }, 200);

  })

  .post("/connect", requireAuth, async (c) => {

    const user = c.get("user")!;

    const body = await c.req.json();

    const raw =

      typeof body.accessToken === "string" ? body.accessToken.trim() : "";



    const extracted = extractXaiAccessTokenFromPaste(raw);

    if (!extracted.token) {

      logXContext("grok_connect_rejected", { reason: extracted.error }, "warn");

      return c.json({ message: extracted.error ?? "Valid accessToken required" }, 400);

    }

    if (!extracted.refreshToken) {

      return c.json(

        {

          message:

            "Paste full ~/.hermes/auth.json (must include refresh_token under xai-oauth). A raw access_token alone expires in ~1 hour.",

          verified: false,

        },

        400

      );

    }

    const accessToken = extracted.token;

    const probe = await probeXaiToken(accessToken);

    if (!probe.ok) {
      const status = probe.status === 401 || probe.status === 403 ? probe.status : 400;
      logXContext("grok_connect_rejected", {
        userId: user.id,
        reasonCode: probe.reasonCode,
        upstreamStatus: probe.status ?? null,
        xaiModel: probe.xaiModel,
        xaiBaseUrl: probe.xaiBaseUrl,
      }, "warn");

      return c.json(

        {

          message: probe.error ?? "Grok token failed x_search validation",

          verified: false,
          upstreamStatus: probe.status ?? null,
          xaiModel: probe.xaiModel,
          xaiBaseUrl: probe.xaiBaseUrl,
          reasonCode: probe.reasonCode,

        },

        status

      );

    }



    logXContext("grok_connect_ok", {

      userId: user.id,

      tokenPreview: accessToken.slice(0, 12),

      fromJson: raw.startsWith("{"),

      xaiModel: probe.xaiModel,

      xaiBaseUrl: probe.xaiBaseUrl,

    });



    const refreshToken =

      typeof body.refreshToken === "string" ? body.refreshToken.trim() : undefined;



    let expiresAt: Date | undefined;

    if (body.expiresAt) {

      const d = new Date(body.expiresAt);

      if (!Number.isNaN(d.getTime())) expiresAt = d;

    }



    await saveUserXaiCredentials(
      user.id,
      accessToken,
      extracted.refreshToken ?? refreshToken,
      extracted.expiresAt ?? expiresAt
    );

    await clearUserXContextCache(user.id);



    return c.json({
      connected: true,
      verified: true,
      xaiModel: probe.xaiModel,
      xaiBaseUrl: probe.xaiBaseUrl,
    }, 200);

  })

  .delete("/disconnect", requireAuth, async (c) => {

    const user = c.get("user")!;

    await deleteUserXaiCredentials(user.id);

    await clearUserXContextCache(user.id);

    return c.json({ connected: false }, 200);

  });



