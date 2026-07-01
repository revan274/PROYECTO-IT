import { LOGO_GIGANTES_DATA_URI } from '../../assets/logoGigantes';

interface LogoGigantesProps {
  className?: string;
}

export function LogoGigantes({ className = 'h-12 w-auto' }: LogoGigantesProps) {
  return (
    <img
      src={LOGO_GIGANTES_DATA_URI}
      alt="Supermercado Los Gigantes"
      className={`object-contain ${className}`}
    />
  );
}
