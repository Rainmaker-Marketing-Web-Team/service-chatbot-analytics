type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function LoadingState() {
  return (
    <section className="surface-panel">
      <div className="state-shell">
        <div>
          <div className="spinner" />
          <h3 style={{ marginBottom: 6 }}>Loading analytics</h3>
          <p className="helper-text" style={{ margin: 0 }}>
            Pulling the latest data and summary metrics from Supabase.
          </p>
        </div>
      </div>
    </section>
  );
}

export function EmptyState() {
  return (
    <div className="state-shell">
      <div>
        <h3 style={{ marginBottom: 6 }}>No records match the current filters</h3>
        <p className="helper-text" style={{ margin: 0 }}>
          Adjust the date range, search query, or filter selections to broaden the result set.
        </p>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section className="surface-panel">
      <div className="state-shell">
        <div>
          <h3 style={{ marginBottom: 6 }}>Analytics request failed</h3>
          <p className="helper-text" style={{ margin: "0 0 14px" }}>{message}</p>
          <button className="button-primary" onClick={onRetry} type="button">
            Retry request
          </button>
        </div>
      </div>
    </section>
  );
}
