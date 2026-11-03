import type { DigestRow, Night } from '../digest/types.js';

// Missing data is a dash, never an empty cell (styleguide).
const show = (value: string | null): string => (value !== null && value.trim() !== '' ? value : '—');

// A job worth a second look: it retried three or more times, or its last run failed.
function worthALook(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function Row({ row }: { row: DigestRow }) {
  return (
    <tr class={worthALook(row) ? 'warn' : undefined}>
      <td>{row.job}</td>
      <td>{show(row.owner)}</td>
      <td>{row.runs}</td>
      <td>{row.retries}</td>
      <td>{row.lastStatus}</td>
      <td>{show(row.lastError)}</td>
      <td>{row.first}</td>
      <td>{row.last}</td>
    </tr>
  );
}

// One night: one table, rows already sorted by job. Times are shown as written in the log.
export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest</h1>
      <p class="mute">{night.night}</p>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <Row row={row} />
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 ? (
        <p class="mute">
          {night.badLines} line{night.badLines === 1 ? '' : 's'} could not be read: this night is partial.
        </p>
      ) : null}
    </>
  );
}
