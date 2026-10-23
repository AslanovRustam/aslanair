import cue from './cue.module.css';

/** "Scroll to …" at the foot of the screen: the words rise in, a line draws down under them and a light runs down it. */
export default function ScrollCue({ label, className }: { label: string; className?: string }) {
  return (
    <p className={className ? `${cue.cue} ${className}` : cue.cue}>
      <span>{label}</span>
      <span className={cue.line} data-part="cue-line" aria-hidden="true">
        <span className={cue.glint} data-part="cue-glint" />
      </span>
    </p>
  );
}
