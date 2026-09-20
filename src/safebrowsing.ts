import axios from "axios";

const SB_ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

export interface SafeBrowsingResult {
  threatFound: boolean;
  threatTypes: string[];
}

/**
 * Проверяет ссылку через Google Safe Browsing — независимый от VirusTotal
 * источник, особенно сильный против фишинга и социальной инженерии.
 * Используется как дополнительный сигнал: если он находит угрозу, вердикт
 * ссылки повышается до «опасно», даже если антивирусы её ещё не поймали.
 */
export async function checkSafeBrowsing(
  url: string,
  apiKey: string
): Promise<SafeBrowsingResult> {
  const response = await axios.post(`${SB_ENDPOINT}?key=${apiKey}`, {
    client: { clientId: "guardix-bot", clientVersion: "1.0.0" },
    threatInfo: {
      threatTypes: [
        "MALWARE",
        "SOCIAL_ENGINEERING",
        "UNWANTED_SOFTWARE",
        "POTENTIALLY_HARMFUL_APPLICATION",
      ],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url }],
    },
  });

  const matches = response.data?.matches as Array<{ threatType: string }> | undefined;

  return {
    threatFound: !!matches && matches.length > 0,
    threatTypes: matches ? [...new Set(matches.map((m) => m.threatType))] : [],
  };
}
