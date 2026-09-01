import {
  parseClassificationResponse,
  type ClassificationResponse,
} from "./classification-contract.ts";

export type MerchantClassifier = (merchants: string[]) => Promise<unknown>;

export async function classifyMerchants(
  merchants: string[],
  classifier: MerchantClassifier,
): Promise<ClassificationResponse> {
  const classifications = await classifier(merchants);
  return parseClassificationResponse(classifications, merchants);
}
