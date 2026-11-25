import type { ReactNode } from 'react';

type Props = { eyebrow: string; title: string; description?: string; actions?: ReactNode };

export function PageHeading({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
