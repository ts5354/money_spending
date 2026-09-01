import { classifyMerchants } from "@/lib/ai/classify-merchants";
import {
  ClassificationContractError,
  MAX_REQUEST_BODY_LENGTH,
  parseClassifyRequest,
  type ClassificationErrorCode,
} from "@/lib/ai/classification-contract";
import { classifyMerchantsWithOpenAI } from "@/lib/ai/openai-merchant-classifier";

type ErrorResponse = {
  error: { code: ClassificationErrorCode };
};

export async function POST(request: Request): Promise<Response> {
  let merchants: string[];

  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_LENGTH) {
      return errorResponse("INVALID_REQUEST", 400);
    }

    const requestText = await request.text();
    if (requestText.length > MAX_REQUEST_BODY_LENGTH) {
      return errorResponse("INVALID_REQUEST", 400);
    }

    merchants = parseClassifyRequest(JSON.parse(requestText) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ClassificationContractError) {
      return errorResponse("INVALID_REQUEST", 400);
    }
    return errorResponse("INVALID_REQUEST", 400);
  }

  try {
    const result = await classifyMerchants(merchants, classifyMerchantsWithOpenAI);
    return Response.json(result);
  } catch {
    return errorResponse("CLASSIFICATION_FAILED", 500);
  }
}

function errorResponse(code: ClassificationErrorCode, status: number): Response {
  return Response.json({ error: { code } } satisfies ErrorResponse, { status });
}
