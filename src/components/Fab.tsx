import type { FC, ReactNode } from 'react';

interface FabProps {
  label: string;
  onClick: () => void;
  background?: string;
  className?: string;
  children?: ReactNode;
}

const Fab: FC<FabProps> = ({ label, onClick, background = '#2563eb', className = 'fab', children }) => {
  return (
    <button type="button" className={className} aria-label={label} onClick={onClick} style={{ background }}>
      {children ?? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
};

export default Fab;
