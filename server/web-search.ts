import fetch from "node-fetch";
import dns from "dns";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

// Perplexity API configuration
const PERPLEXITY_CONFIG = {
  apiKey: process.env.PERPLEXITY_API_KEY || "",
  baseUrl: "https://api.perplexity.ai",
  model: "sonar",
  maxTokens: 1000,
  temperature: 0.1
};

interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
    delta: {
      role: string;
      content: string;
    };
  }>;
}

// Typed error so routes can map failures to honest HTTP status codes.
export class SearchError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'SearchError';
    this.statusCode = statusCode;
  }
}

// Enhanced web search using Perplexity API
export async function searchWeb(
  query: string,
  source: string = "web",
  options?: { apiKey?: string; model?: string }
): Promise<{
  results: Array<{
    title: string;
    snippet: string;
    url: string;
  }>;
  summary?: string;
  error?: string;
}> {
  const apiKey = options?.apiKey || PERPLEXITY_CONFIG.apiKey;
  const model = options?.model || PERPLEXITY_CONFIG.model;

  // No API key → fail loudly instead of fabricating sources.
  if (!apiKey) {
    throw new SearchError(
      'Web search is not configured. Set PERPLEXITY_API_KEY or enter one in Settings → Research.',
      503
    );
  }

  let response;
  try {
    // Call Perplexity API
    response = await fetch(`${PERPLEXITY_CONFIG.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are a helpful research assistant. Provide a comprehensive answer with specific facts and cite your sources. Always include URLs when available."
          },
          {
            role: "user",
            content: `Research this topic: ${query}. Please provide detailed information and cite your sources with URLs.`
          }
        ],
        max_tokens: PERPLEXITY_CONFIG.maxTokens,
        temperature: PERPLEXITY_CONFIG.temperature,
        return_citations: true,
        return_images: false
      })
    });
  } catch (error: any) {
    throw new SearchError(`Could not reach the search service: ${error.message}`, 502);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new SearchError('Perplexity rejected the API key (401/403). Check PERPLEXITY_API_KEY.', 401);
    }    if (response.status === 429) {
      throw new SearchError('Perplexity rate limit exceeded (429). Try again later.', 429);
    }
    throw new SearchError(`Perplexity API error: ${response.status} ${response.statusText}`, 502);
  }

  const data = await response.json() as PerplexityResponse;
  const content = data.choices[0]?.message?.content || "";

  // Extract sources from the response content (real URLs only).
  const sources = extractSourcesFromContent(content);

  return {
    results: sources,
    summary: content,
  };
}

// Extract sources/URLs from Perplexity response content
function extractSourcesFromContent(content: string): Array<{
  title: string;
  snippet: string;
  url: string;
}> {
  const sources: Array<{ title: string; snippet: string; url: string }> = [];
  
  // Look for URLs in the content
  const urlRegex = /https?:\/\/[^\s\)]+/g;
  const urls = content.match(urlRegex) || [];
  
  // Look for citations in brackets like [1], [2], etc.
  const citationRegex = /\[(\d+)\]/g;
  const citations = content.match(citationRegex) || [];
  
  // Extract sentences with citations as snippets
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  urls.forEach((url, index) => {
    // Clean URL of markdown syntax and other malformed patterns
    let cleanUrl = url
      .replace(/\]\(.*$/, '') // Remove markdown link endings like ](...)
      .replace(/\)$/, '')     // Remove trailing parentheses
      .replace(/,$/, '')      // Remove trailing commas
      .replace(/\.$/, '')     // Remove trailing periods
      .trim();
    
    // Validate the cleaned URL
    try {
      new URL(cleanUrl);
    } catch (e) {
      console.warn(`Skipping invalid URL: ${cleanUrl}`);
      return; // Skip this URL if it's still invalid
    }
    
    // Get domain for title
    const domain = cleanUrl.replace(/https?:\/\//, '').split('/')[0];
    const title = domain.charAt(0).toUpperCase() + domain.slice(1).replace(/\./g, ' ');
    
    // Find related sentence for snippet
    const relatedSentence = sentences.find(s => s.includes(`[${index + 1}]`)) || 
                           sentences[index] || 
                           `Information from ${domain}`;
    
    sources.push({
      title: title,
      snippet: relatedSentence.replace(/\[\d+\]/g, '').trim(),
      url: cleanUrl // Use the cleaned URL
    });
  });
  
  return sources;
}

const SCRAPE_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
// Scraping feeds text extraction, not binaries — anything past 2MB is truncated.
const MAX_SCRAPE_BYTES = 2 * 1024 * 1024;

// SSRF guard: scraping must never reach loopback/private/link-local space
// (cloud metadata at 169.254.169.254 included).
function isPrivateAddress(address: string): boolean {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) is judged as plain IPv4.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  const ip = mapped ? mapped[1] : address.toLowerCase();

  if (ip.includes(":")) {
    // IPv6: unspecified (::), loopback (::1), unique-local fc00::/7, link-local fe80::/10
    return ip === "::" || ip === "::1" || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip);
  }

  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true; // malformed → refuse
  const [a, b] = parts;
  return (
    a === 0 || // 0.0.0.0/8 ("this" network)
    a === 10 || // 10.0.0.0/8 private
    a === 127 || // 127.0.0.0/8 loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
    (a === 192 && b === 168) // 192.168.0.0/16 private
  );
}

// Reject if ANY resolved address is private — a record that mixes public and
// private addresses must not be reachable via the public one.
async function assertPublicHost(hostname: string): Promise<void> {
  const addresses = await dns.promises.lookup(hostname, { all: true });
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error(`Refusing to scrape private or local address ${address}`);
    }
  }
}

// Stream the body and stop at the cap. Breaking out of the iterator destroys
// the stream, releasing the socket without buffering the rest.
async function readBodyCapped(stream: NodeJS.ReadableStream): Promise<string> {
  const decoder = new TextDecoder("utf-8");
  let html = "";
  let received = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buf.length;
    html += decoder.decode(buf, { stream: true });
    if (received >= MAX_SCRAPE_BYTES) {
      break;
    }
  }
  html += decoder.decode(); // flush any incomplete trailing sequence
  return html.slice(0, MAX_SCRAPE_BYTES);
}

// Enhanced webpage scraping with Mozilla Readability
export async function scrapeWebpage(url: string): Promise<{
  title: string;
  content: string;
  wordCount: number;
  domain: string;
  error?: string;
}> {
  try {
    // Validate URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Fetch with proper headers, following redirects manually so every hop
    // re-passes the protocol allowlist and SSRF host check.
    let currentUrl = urlObj;
    let response;
    for (let hop = 0; ; hop++) {
      if (currentUrl.protocol !== "http:" && currentUrl.protocol !== "https:") {
        throw new Error("Only http and https URLs are supported");
      }
      await assertPublicHost(currentUrl.hostname);

      response = await fetch(currentUrl.href, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: "manual",
        signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (location && hop >= MAX_REDIRECTS) {
          throw new Error("Too many redirects");
        }
        if (!location) break; // 3xx without a target — reported by the !ok check below
        response.body?.resume(); // drain the hop's body to release the socket
        currentUrl = new URL(location, currentUrl);
        continue;
      }
      break;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("Empty response body");
    }
    const html = await readBodyCapped(response.body);
    
    // Use Readability for better content extraction
    let title = url;
    let content = "";
    
    try {
      // Try Readability first
      const { document } = parseHTML(html);
      const reader = new Readability(document, {
        debug: false,
        charThreshold: 500,
      });
      
      const article = reader.parse();
      
      if (article) {
        title = article.title || domain;
        content = article.textContent || "";
      } else {
        // Fallback to basic extraction
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        title = doc.querySelector("title")?.textContent || domain;
        
        // Extract main content
        const contentElements = Array.from(doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, article, main")) as Element[];
        content = contentElements
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 20)
          .join("\n\n");
      }
    } catch (readabilityError) {
      console.warn("Readability failed, using fallback extraction:", readabilityError);
      
      // Basic JSDOM fallback
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      title = document.querySelector("title")?.textContent || domain;
      content = (Array.from(document.querySelectorAll("p, h1, h2, h3, h4, h5, h6")) as Element[])
        .map(element => element.textContent?.trim())
        .filter(Boolean)
        .join("\n\n");
    }
    
    // Clean content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    
    // Calculate word count
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    
    // Minimum content check
    if (content.length < 100) {
      throw new Error("Content too short - may be blocked or empty page");
    }
    
    return {
      title: title.substring(0, 200), // Limit title length
      content,
      wordCount,
      domain
    };
    
  } catch (error: any) {
    console.error("Error scraping webpage:", error.message);
    
    // Try to extract domain for better error reporting
    let domain = url;
    try {
      domain = new URL(url).hostname;
    } catch (e) {
      // Invalid URL
    }
    
    return {
      title: `Error loading ${domain}`,
      content: "",
      wordCount: 0,
      domain,
      error: `Failed to scrape webpage: ${error.message}`
    };
  }
}
