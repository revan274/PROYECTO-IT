interface LogoGigantesProps {
  className?: string;
}

export function LogoGigantes({ className = 'w-12 h-12' }: LogoGigantesProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 25C40 25 30 20 25 35C25 35 25 45 40 40C40 40 45 50 55 45C55 45 60 35 50 30C50 30 45 20 40 25Z" fill="#8CC63F" />
      <circle cx="55" cy="55" r="35" fill="#F58220" />
      <path d="M72 55C72 64.3888 64.3888 72 55 72C45.6112 72 38 64.3888 38 55C38 45.6112 45.6112 38 55 38V46C50.0294 46 46 50.0294 46 55C46 59.9706 50.0294 64 55 64C59.9706 64 64 59.9706 64 55H55V48H72V55Z" fill="white" />
    </svg>
  );
}
