import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "@ordo/shared/auth-schema";
import { Resend } from "resend";
import { renderWelcomeEmail } from "@ordo/email/welcome";

type AuthEnv = {
  auth_db: D1Database;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
}

// Single auth configuration that handles both CLI and runtime scenarios
function createAuth(env?: AuthEnv, cf?: IncomingRequestCfProperties) {

  // Use actual DB for runtime, empty object for CLI
  const db = env ? drizzle(env.auth_db, { schema, logger: false }) : ({} as any);

  async function sendWelcomeEmail(email: string, name: string) {
    if (!env?.RESEND_API_KEY) return;
    try {
      const resend = new Resend(env.RESEND_API_KEY);
      const { html, text } = await renderWelcomeEmail(name);
      const { error } = await resend.emails.send({
        from: "Ordo <hello@getordo.co>",
        replyTo: "hello@getordo.co",
        to: [email],
        subject: "Welcome to Ordo",
        html,
        text,
      });
      if (error) {
        console.error("[email] Resend error:", error);
      }
    } catch (err) {
      console.error("[email] Failed to send welcome email:", err);
    }
  }

  return betterAuth({
    baseURL: env?.BETTER_AUTH_URL,
    secret: env?.BETTER_AUTH_SECRET,
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:4173",
      "http://localhost:5173",
      "http://localhost:3001",
      "https://ordo-6zh.pages.dev",
      "https://app.getordo.co",
      env?.BETTER_AUTH_URL || "",
    ].filter(Boolean),
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await sendWelcomeEmail(user.email, user.name);
          },
        },
      },
    },
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf: cf || {},
        d1: env
          ? {
            db,
            options: {
              usePlural: true,
              debugLogs: false,
            },
          }
          : undefined,
      },
      {
        session: {
          cookieCache: {
            enabled: true,
            maxAge: 60 * 60,
          },
        },
        emailAndPassword: {
          enabled: true,
        },
        socialProviders: {
          ...(env?.GOOGLE_CLIENT_ID && env?.GOOGLE_CLIENT_SECRET
            ? {
                google: {
                  clientId: env.GOOGLE_CLIENT_ID,
                  clientSecret: env.GOOGLE_CLIENT_SECRET,
                },
              }
            : {}),
        },
        rateLimit: {
          enabled: true,
          window: 60, // Minimum KV TTL is 60s
          max: 100, // reqs/window
          customRules: {
            // https://github.com/better-auth/better-auth/issues/5452
            "/sign-in/email": {
              window: 60,
              max: 100,
            },
            "/sign-in/social": {
              window: 60,
              max: 100,
            },
          },
        },
      }
    ),
    // Only add database adapter for CLI schema generation
    ...(env
      ? {}
      : {
        database: drizzleAdapter({} as D1Database, {
          provider: "sqlite",
          usePlural: true,
          debugLogs: false,
        }),
      }),
  });
}

// Export for CLI schema generation
export const auth = createAuth();

// Export for runtime usage
export { createAuth };
