/** Assistant `content` may be JSON v1 from the Rust backend (thinking + final + stats). */

export type AssistantPayloadV1 = {
  v?: number;
  thinking?: string;
  final?: string;
  genMs?: number;
  tokensPerSec?: number;
  completionTokens?: number;
  promptTokens?: number;
  finishReason?: string;
};

export function emptyAssistantDisplayMessage(finishReason?: string): string {
  if (finishReason === "length") {
    return "The reply was cut off because it reached the max token limit. In **Settings → Hardware**, raise **Max tokens** (4096 or higher) and try again.";
  }
  return "No reply came back from the model. In **Settings → Runtime**, make sure llama-server is installed, then pick your model again and retry.";
}

/** Split inline think tags when the model streams reasoning inside `content`. */
export function splitThinkTaggedContent(text: string): { thinking: string; final: string } {
  const raw = text;
  const tagged: { open: string; close: string }[] = [
    { open: "<" + "think" + ">", close: "<" + "/" + "think" + ">" },
    {
      open: "<" + "redacted_reasoning" + ">",
      close: "<" + "/" + "redacted_reasoning" + ">",
    },
  ];
  for (const { open, close } of tagged) {
    const start = raw.indexOf(open);
    if (start === -1) continue;
    const afterOpen = raw.slice(start + open.length);
    const closeIdx = afterOpen.indexOf(close);
    if (closeIdx !== -1) {
      return {
        thinking: afterOpen.slice(0, closeIdx).trim(),
        final: afterOpen.slice(closeIdx + close.length).trim(),
      };
    }
    return { thinking: afterOpen.trim(), final: "" };
  }
  return { thinking: "", final: raw };
}

export function parseAssistantMessageContent(raw: string): {
  displayFinal: string;
  thinking: string;
  genMs?: number;
  tokensPerSec?: number;
  completionTokens?: number;
  promptTokens?: number;
  finishReason?: string;
  isStructured: boolean;
} {
  const t = raw.trim();
  if (!t.startsWith("{")) {
    const split = splitThinkTaggedContent(raw);
    if (split.thinking) {
      return {
        displayFinal: split.final,
        thinking: split.thinking,
        isStructured: false,
      };
    }
    return { displayFinal: raw, thinking: "", isStructured: false };
  }
  try {
    const j = JSON.parse(t) as AssistantPayloadV1;
    if (j.v !== 1 && j.final === undefined && j.thinking === undefined) {
      return { displayFinal: raw, thinking: "", isStructured: false };
    }
    const finalText = typeof j.final === "string" ? j.final.trim() : "";
    const thinkingText = typeof j.thinking === "string" ? j.thinking.trim() : "";
    const finishReason =
      typeof j.finishReason === "string" ? j.finishReason : undefined;

    let displayFinal = finalText;
    let thinking = thinkingText;

    if (j.v === 1) {
      if (!displayFinal && thinking) {
        displayFinal = thinking;
      } else if (!displayFinal && !thinking) {
        displayFinal = emptyAssistantDisplayMessage(finishReason);
      }
    } else if (!displayFinal && thinking) {
      displayFinal = thinking;
      thinking = "";
    } else if (!displayFinal && !thinking) {
      displayFinal = emptyAssistantDisplayMessage(finishReason);
    }

    return {
      displayFinal,
      thinking,
      genMs: typeof j.genMs === "number" ? j.genMs : undefined,
      tokensPerSec: typeof j.tokensPerSec === "number" ? j.tokensPerSec : undefined,
      completionTokens: typeof j.completionTokens === "number" ? j.completionTokens : undefined,
      promptTokens: typeof j.promptTokens === "number" ? j.promptTokens : undefined,
      finishReason,
      isStructured: true,
    };
  } catch {
    return { displayFinal: raw, thinking: "", isStructured: false };
  }
}
