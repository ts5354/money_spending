import "server-only";

import OpenAI from "openai";

import { CLASSIFICATION_OUTPUT_SCHEMA } from "@/lib/ai/classification-contract";

const DEFAULT_MODEL = "gpt-5.6-luna";

const CLASSIFICATION_INSTRUCTIONS = `あなたは日本のクレジットカード利用明細に表示される店舗名を分類します。

各merchantを、必ず指定されたカテゴリのいずれか1つに分類してください。

利用可能なカテゴリ：
convenience_store
supermarket
vending_machine
restaurant
subscription
shopping
transportation
entertainment
other

店舗名だけから判断してください。
不明確な場合、推測で新しいカテゴリを作らず other を使用してください。
同じmerchant文字列を変更・要約・翻訳しないでください。
入力されたmerchant文字列をそのまま返してください。
支出が良い・悪い・無駄かどうかを判断してはいけません。`;

export async function classifyMerchantsWithOpenAI(merchants: string[]): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    store: false,
    instructions: CLASSIFICATION_INSTRUCTIONS,
    input: JSON.stringify({ merchants }),
    text: {
      format: {
        type: "json_schema",
        name: "merchant_categories",
        strict: true,
        schema: CLASSIFICATION_OUTPUT_SCHEMA,
      },
    },
  });

  if (response.status !== "completed" || response.output_text === "") {
    throw new Error("OpenAI classification did not complete.");
  }

  return JSON.parse(response.output_text) as unknown;
}
