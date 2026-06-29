import { readDataConnection, readDataConnections } from "../../_shared/dataConnection";

interface Env {
  DB: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
}

type PagesFunction<Bindings> = (context: {
  env: Bindings;
  request: Request;
}) => Response | Promise<Response>;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const dataConnection = await readDataConnection(env);
  const dataConnections = await readDataConnections(env);
  return json({
    ...dataConnection,
    data_connections: dataConnections,
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
