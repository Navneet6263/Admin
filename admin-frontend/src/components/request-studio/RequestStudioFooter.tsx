type Props = {
  canSubmit: boolean; submitting: boolean; error: string; onClose: () => void; onSubmit: () => void;
};

export function RequestStudioFooter(props: Props) {
  return <>
    {props.error && <p role="alert" className="mb-3 text-sm text-rose-300">{props.error}</p>}
    <div className="studio-footer-controls">
      <span className="studio-footer-hint">Track updates in your portal</span>
      <button type="button" disabled={props.submitting} onClick={props.onClose}>Cancel</button>
      <button type="button" className="studio-primary-action" disabled={props.submitting || !props.canSubmit} onClick={props.onSubmit}>
        {props.submitting ? "Submitting…" : "Submit request"}
      </button>
    </div>
  </>;
}
