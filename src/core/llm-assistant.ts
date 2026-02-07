const STORAGE_KEY = 'resql_anthropic_api_key';
const MODEL = 'claude-sonnet-4-5-20250929';

const SYSTEM_PROMPT = `You are a SQL autocomplete engine for a SQLite database (Chinook music database).

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
- The user is typing a SQL query. Predict what comes next.
- Return ONLY the text that should be appended after the user's cursor.
- Do NOT repeat any part of the user's input.
- Keep completions concise — finish the current clause or add the next logical one.
- If the query looks complete, return an empty string.
- Use proper SQLite syntax and valid column/table names from the schema above.
- No markdown, no explanation, no code fences.`;

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

export interface AutocompleteResult {
  success: boolean;
  completion?: string;
  error?: string;
}

export async function autocompleteQuery(
  sql: string,
  signal?: AbortSignal
): Promise<AutocompleteResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: 'No API key configured.' };
  }

  if (!sql.trim()) {
    return { success: false, error: 'Empty query.' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: sql },
        ],
        temperature: 0.2,
      }),
      signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const msg = body?.error?.message || `API error: ${response.status}`;
      return { success: false, error: msg };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';

    return { success: true, completion: text };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Cancelled.' };
    }
    return { success: false, error: err.message || 'Unknown error.' };
  }
}
