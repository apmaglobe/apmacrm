export type Row = {
  id: string;
  organization_id: string;
  version: number;
  [key: string]: unknown;
};
export async function command(
  org: string,
  domain: string,
  operation: string,
  payload: Record<string, unknown>,
  expected_version = 1,
  request_id = crypto.randomUUID(),
) {
  const res = await fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      org,
      domain,
      operation,
      payload,
      expected_version,
      request_id,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data as {
    signing_secret?: string;
    candidates: {
      index: number;
      matches: { id: string; name: string; external_id: string }[];
    }[];
    id: string;
    version: number;
    cursor?: number;
    status?: string;
  };
}
