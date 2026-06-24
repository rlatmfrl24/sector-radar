import { readDataConnection } from "../_shared/dataConnection";

interface Env {
  DB: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
}

type PagesFunction<Bindings> = (context: {
  env: Bindings;
  request: Request;
}) => Response | Promise<Response>;

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  return json({
    status: "refresh_unavailable_in_pages",
    data_connection: await readDataConnection(env, {
      message: "Cloudflare Pages public manual refresh is disabled. Scheduled Worker cron owns Yahoo refresh.",
    }),
  });
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
