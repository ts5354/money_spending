import { createAuthorizedApiHandler } from "@/lib/auth/api-authorization";
import { getAccessState } from "@/lib/auth/authorization";
import { createClassificationHttpHandler } from "@/lib/ai/classification-http-handler";
import { classifyMerchantsWithOpenAI } from "@/lib/ai/openai-merchant-classifier";

export const POST = createAuthorizedApiHandler(
  getAccessState,
  createClassificationHttpHandler(classifyMerchantsWithOpenAI),
);
