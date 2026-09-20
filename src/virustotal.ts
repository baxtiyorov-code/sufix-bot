import axios from "axios";
import FormData from "form-data";
import crypto from "crypto";

const VT_BASE = "https://www.virustotal.com/api/v3";

interface VtAnalysisStats {
  malicious: number;
  suspicious: number;
  undetected: number;
  harmless: number;
  timeout: number;
}

export interface ScanResult {
  stats: VtAnalysisStats;
  permalink: string;
}

/**
 * Считает SHA256-хэш файла — используется, чтобы сначала проверить,
 * не сканировали ли этот файл раньше (экономия лимитов API).
 */
export function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Проверяет, есть ли уже готовый отчёт по этому хэшу в базе VirusTotal.
 * Возвращает null, если файл ещё никогда не проверялся (нужна полная загрузка).
 */
export async function getReportByHash(
  hash: string,
  apiKey: string
): Promise<ScanResult | null> {
  try {
    const response = await axios.get(`${VT_BASE}/files/${hash}`, {
      headers: { "x-apikey": apiKey },
    });

    const stats: VtAnalysisStats =
      response.data.data.attributes.last_analysis_stats;

    return {
      stats,
      permalink: `https://www.virustotal.com/gui/file/${hash}`,
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // файл не найден в базе — придётся загружать целиком
    }
    throw error;
  }
}

/**
 * Загружает файл в VirusTotal и возвращает ID анализа.
 * Для файлов до 32 МБ используется обычный endpoint /files.
 */
async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  apiKey: string
): Promise<string> {
  const form = new FormData();
  form.append("file", fileBuffer, fileName);

  const response = await axios.post(`${VT_BASE}/files`, form, {
    headers: {
      ...form.getHeaders(),
      "x-apikey": apiKey,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return response.data.data.id as string;
}

/**
 * Опрашивает статус анализа, пока он не завершится (или не истечёт таймаут).
 */
async function waitForAnalysis(
  analysisId: string,
  apiKey: string,
  maxAttempts = 30,
  delayMs = 4000
): Promise<any> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await axios.get(`${VT_BASE}/analyses/${analysisId}`, {
      headers: { "x-apikey": apiKey },
    });

    const status = response.data.data.attributes.status;
    if (status === "completed") {
      return response.data;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Анализ не завершился за отведённое время. Попробуйте позже.");
}

/**
 * Полный цикл: загрузка файла + ожидание результата.
 * Используется только если getReportByHash не нашёл готового отчёта.
 */
export async function scanFile(
  fileBuffer: Buffer,
  fileName: string,
  apiKey: string
): Promise<ScanResult> {
  const analysisId = await uploadFile(fileBuffer, fileName, apiKey);
  const analysisData = await waitForAnalysis(analysisId, apiKey);

  const stats: VtAnalysisStats = analysisData.data.attributes.stats;
  const fileId = analysisData.meta?.file_info?.sha256;
  const permalink = fileId
    ? `https://www.virustotal.com/gui/file/${fileId}`
    : "https://www.virustotal.com";

  return { stats, permalink };
}

/** Идентификатор URL в VirusTotal — base64url от адреса без паддинга. */
export function urlId(url: string): string {
  return Buffer.from(url).toString("base64url").replace(/=+$/, "");
}

/**
 * Проверяет, есть ли уже готовый отчёт по этой ссылке в базе VirusTotal.
 * Возвращает null, если ссылку ещё никогда не проверяли (нужен полный анализ).
 */
export async function getUrlReport(
  url: string,
  apiKey: string
): Promise<ScanResult | null> {
  const id = urlId(url);
  try {
    const response = await axios.get(`${VT_BASE}/urls/${id}`, {
      headers: { "x-apikey": apiKey },
    });

    const stats: VtAnalysisStats =
      response.data.data.attributes.last_analysis_stats;

    return {
      stats,
      permalink: `https://www.virustotal.com/gui/url/${id}`,
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // ссылка не найдена в базе — нужен полный анализ
    }
    throw error;
  }
}

/** Отправляет ссылку на анализ и возвращает ID анализа. */
async function submitUrl(url: string, apiKey: string): Promise<string> {
  const form = new URLSearchParams();
  form.append("url", url);

  const response = await axios.post(`${VT_BASE}/urls`, form.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-apikey": apiKey,
    },
  });

  return response.data.data.id as string;
}

/**
 * Полный цикл: отправка ссылки + ожидание результата.
 * Используется только если getUrlReport не нашёл готового отчёта.
 */
export async function scanUrl(url: string, apiKey: string): Promise<ScanResult> {
  const analysisId = await submitUrl(url, apiKey);
  const analysisData = await waitForAnalysis(analysisId, apiKey);

  const stats: VtAnalysisStats = analysisData.data.attributes.stats;

  return { stats, permalink: `https://www.virustotal.com/gui/url/${urlId(url)}` };
}