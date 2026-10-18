const DEFAULT_ORIGINS = [
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
];

function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  const allowed = [
    ...DEFAULT_ORIGINS,
    ...(process.env.CORS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ];

  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Max-Age", "86400");

  if (origin && allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

export function apiJson(
  request: Request,
  body: unknown,
  status = 200
): Response {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), { status, headers });
}

export function apiOptions(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
