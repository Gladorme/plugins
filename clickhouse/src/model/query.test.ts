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

import { createContext } from '../../test/context';
import { executeQuery, interpolateQuery, queryDependencies } from './query';

describe('ClickHouse query execution', () => {
  it('quotes scalar and multi-select SQL values with quotes and backslashes', () => {
    const state = { service: { value: ["a'b", String.raw`x\' OR 1=1 --`], loading: false } };
    expect(interpolateQuery('ServiceName IN (${service:sqlstring})', state)).toBe(
      String.raw`ServiceName IN ('a''b','x\\'' OR 1=1 --')`,
    );
    expect(interpolateQuery('${empty:sqlstring}', { empty: { value: null, loading: false } })).toBe('NULL');
  });

  it('does not recursively interpolate variable contents', () => {
    expect(
      interpolateQuery('${a:sqlstring}', {
        a: { value: '$b', loading: false },
        b: { value: 'secret', loading: false },
      }),
    ).toBe("'$b'");
  });

  it('does not expand time placeholders introduced by variable values', async () => {
    const context = createContext();
    context.variableState.value = { value: '{start}', loading: false };
    await executeQuery({ query: 'SELECT ${value:sqlstring}' }, context);
    expect(context.query).toHaveBeenCalledWith({ query: "SELECT '{start}'" });
  });

  it('includes query and datasource variables exactly once', () => {
    expect(queryDependencies({ query: 'SELECT $a, ${a:sqlstring}, $b', datasource: '$source' })).toEqual({
      variables: ['a', 'b', 'source'],
    });
  });

  it('passes time bounds, step, cancellation and SQL metadata consistently', async () => {
    const context = createContext();
    const signal = new AbortController().signal;
    const result = await executeQuery(
      { query: "SELECT '{start}', '{end}', {step}" },
      {
        ...context,
        suggestedStepMs: 1501,
      },
      signal,
    );
    expect(context.query).toHaveBeenCalledWith(
      {
        query: "SELECT '2025-01-01 00:00:00', '2025-01-01 01:00:00', 2",
      },
      undefined,
      signal,
    );
    expect(result.executedQueryString).toBe("SELECT '2025-01-01 00:00:00', '2025-01-01 01:00:00', 2");
  });

  it('resolves datasource variables without falling back to a different database', async () => {
    const context = createContext();
    context.variableState.source = { value: 'production', loading: false };
    vi.mocked(context.datasourceStore.listDatasourceSelectItems).mockResolvedValue([
      {
        group: 'Project',
        items: [{ name: 'production', selector: { kind: 'ClickHouseDatasource', name: 'production' } }],
      },
    ]);
    await executeQuery({ query: 'SELECT 1', datasource: '$source' }, context);
    expect(context.datasourceStore.getDatasourceClient).toHaveBeenCalledWith({
      kind: 'ClickHouseDatasource',
      name: 'production',
    });
    await expect(executeQuery({ query: 'SELECT 1', datasource: '$missing' }, context)).rejects.toThrow(
      'must select one',
    );
  });

  it('rejects missing ranges, malformed rows and explicit server errors', async () => {
    const context = createContext();
    await expect(
      executeQuery(
        { query: "SELECT '{start}'" },
        {
          ...context,
          timeRange: undefined,
        },
      ),
    ).rejects.toThrow('requires a time range');
    context.query.mockResolvedValueOnce({ status: 'error', data: [] });
    await expect(executeQuery({ query: 'SELECT 1' }, context)).rejects.toThrow('query failed');
    context.query.mockResolvedValueOnce({ status: 'success', data: ['bad row'] });
    await expect(executeQuery({ query: 'SELECT 1' }, context)).rejects.toThrow('JSON rows');
  });
});
