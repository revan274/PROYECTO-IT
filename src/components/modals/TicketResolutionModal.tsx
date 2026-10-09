import { useId, useState } from 'react';
import { ModalLayout } from './ModalLayout';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { TextArea } from '../ui/TextArea';

interface Props {
  ticketId: number;
  onClose: () => void;
  onResolve: (id: number, solution: string, diagnosis: string) => Promise<boolean>;
}

export function TicketResolutionModal({ ticketId, onClose, onResolve }: Props) {
  const id = useId();
  const [solution, setSolution] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <ModalLayout isOpen title={`Resolver ticket #${ticketId}`} onClose={onClose} isBusy={busy}>
      <form className="space-y-5 p-4 sm:p-6" noValidate onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        if (!solution.trim()) {
          setError('Describe la solución aplicada.');
          return;
        }
        setError('');
        setBusy(true);
        try {
          if (await onResolve(ticketId, solution.trim(), diagnosis.trim())) onClose();
          else setError('No se pudo guardar. Revisa el aviso e inténtalo nuevamente.');
        } catch {
          setError('No se pudo guardar. Tu texto se conserva para reintentar.');
        } finally { setBusy(false); }
      }}>
        <Field label="Solución aplicada (obligatoria)" htmlFor={`${id}-solution`}
          error={error && <span id={`${id}-error`} role="alert">{error}</span>}>
          <TextArea id={`${id}-solution`} required maxLength={8000} rows={5} className="w-full"
            value={solution} onChange={(event) => setSolution(event.target.value)} disabled={busy}
            invalid={!!error} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
        </Field>
        <Field label="Diagnóstico (opcional)" htmlFor={`${id}-diagnosis`}>
          <TextArea id={`${id}-diagnosis`} maxLength={8000} rows={3} className="w-full"
            value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} disabled={busy} />
        </Field>
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" disabled={busy} onClick={onClose}>Volver</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar solución'}</Button>
        </div>
      </form>
    </ModalLayout>
  );
}
