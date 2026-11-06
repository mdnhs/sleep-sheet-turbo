import { getGeminiConfig } from "@/lib/server-config";
import { toEnglishDigits } from "@/features/fraud-checker/phone";

// "-latest" alias: Google points it at the newest Flash-Lite model, which has
// a free tier, so this doesn't need touching when a new one ships.
const GEMINI_MODEL = "gemini-flash-lite-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export class GeminiError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export interface ExtractedCustomer {
  name: string;
  phone: string;
  address: string;
}

const PROMPT = [
  "This is a screenshot of a customer conversation or order message (usually Bangla and/or English, e.g. from Facebook Messenger or WhatsApp).",
  "Extract the customer's delivery details: full name, mobile phone number, and full delivery address.",
  "Keep the name and address in the language they were written in; do not translate.",
  "Write the phone number with English digits only (0-9). If a value is not present, return an empty string.",
].join(" ");

/** Reads name / phone / address out of a screenshot. The image is only held in memory for the request. */
export async function extractCustomerFromImage(base64: string, mimeType: string): Promise<ExtractedCustomer> {
  const { apiKey } = await getGeminiConfig();
  if (!apiKey) throw new GeminiError("সেটিংসে Gemini API key দিন", 400);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              phone: { type: "STRING" },
              address: { type: "STRING" },
            },
            required: ["name", "phone", "address"],
          },
        },
      }),
    });
  } catch {
    throw new GeminiError("Gemini এর সাথে যোগাযোগ করা যায়নি, আবার চেষ্টা করুন");
  }

  if (res.status === 429) throw new GeminiError("Gemini এর ফ্রি লিমিট শেষ, কিছুক্ষণ পর চেষ্টা করুন", 429);
  if (res.status === 400 || res.status === 403) {
    throw new GeminiError("Gemini API key সঠিক নয় বা এই ছবি পড়া যায়নি", 400);
  }
  if (!res.ok) throw new GeminiError("Gemini থেকে উত্তর পাওয়া যায়নি, আবার চেষ্টা করুন");

  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiError("ছবি থেকে কিছু পড়া যায়নি");

  let parsed: Partial<ExtractedCustomer>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiError("ছবি থেকে কিছু পড়া যায়নি");
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const phoneDigits = toEnglishDigits(str(parsed.phone)).replace(/[^\d+]/g, "");
  return { name: str(parsed.name), phone: phoneDigits, address: str(parsed.address) };
}
