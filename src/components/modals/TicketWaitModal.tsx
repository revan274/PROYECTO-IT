import { useId, useState } from 'react';
import { TICKET_WAIT_REASONS } from '../../../shared/ticket-wait-policy.js';
import type { TicketWaitReasonValue } from '../../../shared/ticket-wait-policy.js';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { ModalLayout } from './ModalLayout';

interface Props {
  ticketId: number;
  onClose: () => void;
  onApply: (id: number, reason: TicketWaitReasonValue) => Promise<boolean>;
}

export function TicketWaitModal({ ticketId, onClose, onApply }: Props) {
  const id = useId();
  const [reason, setReason] = useState<TicketWaitReasonValue | ''>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const policy = TICKET_WAIT_REASONS.find((item) => item.value === reason);

  return (
    <ModalLayout isOpen title={`Poner en espera ticket #${ticketId}`} onClose={onClose} isBusy={busy}>
      <form className="space-y-5 p-4 sm:p-6" noValidate onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        if (!reason) {
          setError('Selecciona el motivo de espera.');
          return;
        }
        setError('');
        setBusy(true);
        try {
          if (await onApply(ticketId, reason)) onClose();
          else setError('No se pudo guardar. Revisa el aviso e inténtalo nuevamente.');
        } catch {
          setError('No se pudo guardar el motivo de espera.');
        } finally {
          setBusy(false);
        }
      }}>
        <Field label="Motivo de espera" htmlFor={`${id}-reason`}
          error={error && <span id={`${id}-error`} role="alert">{error}</span>}>
          <Select id={`${id}-reason`} required className="w-full" value={reason} disabled={busy}
            invalid={!!error} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => setReason(event.target.value as TicketWaitReasonValue)}>
            <option value="">Selecciona un motivo</option>
            {TICKET_WAIT_REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </Field>
        {policy && (
          <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-600" role="status">
            {policy.pausaSla
              ? 'Este motivo pausa el SLA. Al reanudar se extenderá el vencimiento por los minutos hábiles pausados.'
              : 'Este motivo no pausa el SLA; el vencimiento actual se conserva.'}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" disabled={busy} onClick={onClose}>Volver</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Guardando…' : 'Poner en espera'}</Button>
        </div>
      </form>
    </ModalLayout>
  );
}
