const STORAGE_KEY = 'resql_openai_api_key';
const DEFAULT_MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are a SQL query assistant for a SQLite database (Chinook music database).
Your job is to improve, autocomplete, or fix the user's SQL query.

Database schema:
- Artist(ArtistId, Name)
- Album(AlbumId, Title, ArtistId)
- Track(TrackId, Name, AlbumId, MediaTypeId, GenreId, Composer, Milliseconds, Bytes, UnitPrice)
- Genre(GenreId, Name)
- MediaType(MediaTypeId, Name)
- Playlist(PlaylistId, Name)
- PlaylistTrack(PlaylistId, TrackId)
- Customer(CustomerId, FirstName, LastName, Company, Address, City, State, Country, PostalCode, Phone, Fax, Email, SupportRepId)
- Employee(EmployeeId, LastName, FirstName, Title, ReportsTo, BirthDate, HireDate, Address, City, State, Country, PostalCode, Phone, Fax, Email)
- Invoice(InvoiceId, CustomerId, InvoiceDate, BillingAddress, BillingCity, BillingState, BillingCountry, BillingPostalCode, Total)
- InvoiceLine(InvoiceLineId, InvoiceId, TrackId, UnitPrice, Quantity)

Rules:
- Return ONLY the improved SQL query, no explanation.
- If the query is incomplete, complete it logically.
- If the query has errors, fix them.
- If the query can be improved (better joins, missing clauses, etc.), improve it.
- Use proper SQLite syntax.
- Keep the user's intent — don't change what the query is trying to do.
- Do NOT wrap the output in markdown code fences.`;

export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function hasApiKey(): boolean {
  const key = getApiKey();
  return key !== null && key.length > 0;
}

export interface LLMResult {
  success: boolean;
  query?: string;
  error?: string;
}

export async function improveQuery(
  sql: string,
  signal?: AbortSignal
): Promise<LLMResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: 'No API key configured. Click the key icon to add your OpenAI API key.' };
  }

  if (!sql.trim()) {
    return { success: false, error: 'No query to improve.' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: sql },
        ],
        temperature: 0.2,
        max_tokens: 512,
      }),
      signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const msg = body?.error?.message || `API error: ${response.status}`;
      return { success: false, error: msg };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return { success: false, error: 'Empty response from API.' };
    }

    return { success: true, query: content };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request cancelled.' };
    }
    return { success: false, error: err.message || 'Unknown error.' };
  }
}
