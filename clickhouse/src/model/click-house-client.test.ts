// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { formatClickHouseDateTime, query, replaceTimeRangePlaceholders } from './click-house-client';

describe('ClickHouse client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should replace time range placeholders', () => {
    expect(
      replaceTimeRangePlaceholders(
        "SELECT * FROM logs WHERE timestamp BETWEEN '{start}' AND '{end}'",
        '2025-01-01 00:00:00',
        '2025-01-02 00:00:00',
      ),
    ).toEqual("SELECT * FROM logs WHERE timestamp BETWEEN '2025-01-01 00:00:00' AND '2025-01-02 00:00:00'");
  });

  it('should format time range dates for ClickHouse SQL literals', () => {
    expect(formatClickHouseDateTime(new Date('2025-01-01T00:00:00.000Z'))).toBe('2025-01-01 00:00:00');
  });

  it('should send interpolated query to ClickHouse', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>>(async () => ({
      ok: true,
      json: vi.fn(async () => ({ data: [] })),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await query(
      {
        query: "SELECT * FROM logs WHERE timestamp BETWEEN '{start}' AND '{end}'",
        start: '2025-01-01 00:00:00',
        end: '2025-01-02 00:00:00',
      },
      {
        datasourceUrl: 'http://clickhouse.example.com',
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0]!;
    const url = new URL(calledUrl);
    expect(url.searchParams.get('default_format')).toBe('JSON');
    expect(url.searchParams.get('query')).toBe(
      "SELECT * FROM logs WHERE timestamp BETWEEN '2025-01-01 00:00:00' AND '2025-01-02 00:00:00'",
    );
  });
});

describe('ClickHouse HTTP contract', () => {
  it('leaves the database to the server or proxy unless explicitly configured', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(async () => new Response('{"data":[]}'));
    const options = { datasourceUrl: 'http://perses.example.com/proxy', fetch: mockFetch };
    await query({ query: 'SELECT currentDatabase()' }, options);
    expect(new URL(String(mockFetch.mock.calls[0]?.[0])).searchParams.has('database')).toBe(false);
    await query({ query: 'SELECT currentDatabase()', database: 'observability' }, options);
    expect(new URL(String(mockFetch.mock.calls[1]?.[0])).searchParams.get('database')).toBe('observability');
  });

  it('preserves database URL settings, headers and abort signals without rewriting SQL', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          meta: [{ name: 'value', type: 'Int64' }],
          data: [{ value: '1' }],
        }),
      ),
    );
    const signal = new AbortController().signal;
    const result = await query(
      { query: "SELECT 'FORMAT JSON' AS value; -- comment" },
      {
        datasourceUrl: 'http://localhost:8123/?database=otel&max_execution_time=5',
        headers: { 'X-ClickHouse-User': 'reader' },
        signal,
        fetch: mockFetch,
      },
    );
    const url = new URL(String(mockFetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get('database')).toBe('otel');
    expect(url.searchParams.get('max_execution_time')).toBe('5');
    expect(url.searchParams.get('query')).toBe("SELECT 'FORMAT JSON' AS value; -- comment");
    expect(url.searchParams.get('date_time_output_format')).toBe('iso');
    expect(url.searchParams.get('output_format_json_quote_64bit_integers')).toBe('1');
    expect(mockFetch.mock.calls[0]?.[1]).toMatchObject({ signal, headers: { 'X-ClickHouse-User': 'reader' } });
    expect(result.meta).toEqual([{ name: 'value', type: 'Int64' }]);
  });

  it('reports ClickHouse errors instead of returning an empty success', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('Unknown table otel_logs', { status: 404 }));
    await expect(
      query(
        { query: 'SELECT * FROM otel_logs' },
        {
          datasourceUrl: 'http://localhost:8123',
          fetch: mockFetch,
        },
      ),
    ).rejects.toThrow('ClickHouse query failed (404): Unknown table otel_logs');
  });

  it('rejects malformed JSON rows and retains the original cancellation error', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{"rows":0}'));
    await expect(
      query(
        { query: 'SELECT 1' },
        {
          datasourceUrl: 'http://localhost:8123',
          fetch: mockFetch,
        },
      ),
    ).rejects.toThrow('JSON rows');
    const aborted = new DOMException('Aborted', 'AbortError');
    mockFetch.mockRejectedValueOnce(aborted);
    await expect(
      query(
        { query: 'SELECT 1' },
        {
          datasourceUrl: 'http://localhost:8123',
          fetch: mockFetch,
        },
      ),
    ).rejects.toBe(aborted);
  });

  it('retains milliseconds in time bounds', () => {
    expect(formatClickHouseDateTime(new Date('2025-01-01T00:00:00.123Z'))).toBe('2025-01-01 00:00:00.123');
  });
});
