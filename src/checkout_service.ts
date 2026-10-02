import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { decidePayment, paymentEventSchema } from "./experiment_assignment.js";
import { infrai, InfraiError } from "./infrai_flags.js";

const flagKey = "fintech-checkout-risk-experiment";

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) throw new RangeError("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/checkout/decision") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const event = paymentEventSchema.parse(await readJson(request));
    const flag = await infrai.flags.get_value(flagKey);
    const experimentEnabled = flag.value === true;
    json(response, 200, decidePayment(event, experimentEnabled));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError || error instanceof RangeError) {
      json(response, 400, { error: "Invalid payment event" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 502, { error: "Checkout decision dependency error" });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Checkout decision service listening on http://localhost:${port}`));
}
