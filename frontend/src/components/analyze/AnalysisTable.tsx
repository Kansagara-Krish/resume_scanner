import Link from 'next/link';
import { AnalysisBadge } from '@/components/analyze/Badge';
import { Button } from '@/components/ui/button';

type AnalysisRow = {
  id: string;
  rank: number;
  filename: string;
  role: string;
  score: number;
  topSkills: string[];
};

type AnalysisTableProps = {
  rows: AnalysisRow[];
  shortlistedById: Record<string, boolean>;
  selectedById: Record<string, boolean>;
  onToggleShortlist: (id: string) => void;
  onToggleSelect: (id: string) => void;
};

export function AnalysisTable({
  rows,
  shortlistedById,
  selectedById,
  onToggleShortlist,
  onToggleSelect,
}: AnalysisTableProps) {
  const csvRows = rows.map((row) => ({
    ...row,
    shortlisted: Boolean(shortlistedById[row.id]),
    selected: Boolean(selectedById[row.id]),
  }));

  const toCsvWithState = () => {
    const header = ['Rank', 'Candidate / Filename', 'Target Role', 'Match Score', 'Shortlisted', 'Selected'];
    const tableRows = csvRows.map((row) => [
      row.rank,
      row.filename,
      row.role,
      `${row.score}%`,
      row.shortlisted ? 'YES' : 'NO',
      row.selected ? 'YES' : 'NO',
    ]);

    return [header, ...tableRows]
      .map((cols) => cols.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  };

  const handleDownload = () => {
    const csv = toCsvWithState();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidates-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--app-text)]">Recent Analysis Reports</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleDownload}
            className="border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]"
          >
            Download Candidates
          </Button>
          <Link href="/candidates" className="rounded-md px-2 py-1 text-sm font-medium text-[var(--app-brand)] hover:underline">
            View All
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
        <table className="min-w-full text-sm text-[var(--app-text)]">
          <thead className="bg-[var(--app-surface-soft)] text-left text-xs uppercase tracking-wide text-[var(--app-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Rank</th>
              <th className="px-4 py-3 font-semibold">Candidate / Filename</th>
              <th className="px-4 py-3 font-semibold">Target Role</th>
              <th className="px-4 py-3 font-semibold">Match Score</th>
              <th className="px-4 py-3 font-semibold">Shortlist</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Final Selection</th>
            </tr>
          </thead>
          <tbody className="bg-[var(--app-surface-elevated)]">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-[var(--app-border)] transition-colors hover:bg-[var(--app-surface-soft)] ${
                  selectedById[row.id] ? 'bg-[var(--app-surface-soft)]' : row.rank <= 3 ? 'bg-[var(--app-surface)]' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--app-text)]">#{row.rank}</span>
                    {row.rank <= 3 ? (
                      <AnalysisBadge tone="success" className="inline-flex shrink-0 items-center justify-center whitespace-nowrap px-2 py-1 text-xs leading-none">
                        Top {row.rank}
                      </AnalysisBadge>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-[var(--app-text)]">{row.filename}</td>
                <td className="px-4 py-3 text-[var(--app-muted)]">{row.role}</td>
                <td className="px-4 py-3">
                  <AnalysisBadge tone="green">{row.score}% Match</AnalysisBadge>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onToggleShortlist(row.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      shortlistedById[row.id]
                        ? 'border border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]'
                    }`}
                  >
                    {shortlistedById[row.id] ? 'Saved for Review' : 'Save for Review'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onToggleSelect(row.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      selectedById[row.id]
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]'
                    }`}
                  >
                    {selectedById[row.id] ? 'Selected' : 'Final Select'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {selectedById[row.id] ? (
                    <AnalysisBadge tone="success">Yes</AnalysisBadge>
                  ) : (
                    <AnalysisBadge tone="neutral">No</AnalysisBadge>
                  )}
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--app-muted)]">
                  No analysis reports for the selected job role.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
