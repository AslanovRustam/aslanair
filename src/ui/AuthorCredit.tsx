import { copy } from '@/content/copy';
import styles from './shell.module.css';

/** "Concept & code: Aslanov Rustam · GitHub" — the author's line, the link opening in a new tab. */
export function AuthorCredit({ className }: { className?: string }) {
  const { line, link, href } = copy.author;
  return (
    <p className={className}>
      {line} ·{' '}
      <a className={styles.authorLink} href={href} target="_blank" rel="noopener noreferrer">
        {link}
      </a>
    </p>
  );
}
