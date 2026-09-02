import { classifyMerchants, type MerchantClassifier } from "./classify-merchants.ts";
import {
  ClassificationContractError,
  MAX_REQUEST_BODY_LENGTH,
  parseClassifyRequest,
  type ClassificationErrorCode,
} from "./classification-contract.ts";

type ErrorResponse = { error: { code: ClassificationErrorCode } };

export function createClassificationHttpHandler(
  classifier: MerchantClassifier,
) {
  return async function handleClassificationRequest(request: Request): Promise<Response> {
    let merchants: string[];

    try {
      const contentLength = Number(request.headers.get("content-length") ?? "0");
      if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_LENGTH) {
        return errorResponse("INVALID_REQUEST", 400);
      }
      const requestText = await request.text();
      if (requestText.length > MAX_REQUEST_BODY_LENGTH) return errorResponse("INVALID_REQUEST", 400);
      merchants = parseClassifyRequest(JSON.parse(requestText) as unknown);
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof ClassificationContractError) {
        return errorResponse("INVALID_REQUEST", 400);
      }
      return errorResponse("INVALID_REQUEST", 400);
    }

    try {
      return Response.json(await classifyMerchants(merchants, classifier));
    } catch {
      return errorResponse("CLASSIFICATION_FAILED", 500);
    }
  };
}

function errorResponse(code: ClassificationErrorCode, status: number): Response {
  return Response.json({ error: { code } } satisfies ErrorResponse, { status });
}
