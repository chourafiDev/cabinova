'use client';

import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IconCheck, IconCopy, IconDownload, IconSpinner } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';

/** Ten single-use backup codes, shown once: copy or download them. */
export function RecoveryCodes({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  const text = codes.join('\n');
  const t = useTranslations('auth.setup');
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        {t('codesIntro')} <strong>{t('codesOnce')}</strong>
      </p>
      <ol dir="ltr" className="bg-muted/40 grid grid-cols-2 gap-2 rounded-lg border p-3 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            toast.success(t('copied'));
          }}
        >
          <IconCopy /> {t('copy')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([`${t('fileTitle')}\n\n${text}\n`], {
                type: 'text/plain',
              })
            );
            const a = Object.assign(document.createElement('a'), {
              href: url,
              download: 'cabinova-codes-de-secours.txt',
            });
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <IconDownload /> {t('download')}
        </Button>
        <Button type="button" size="sm" className="ms-auto" onClick={onDone}>
          <IconCheck /> {t('saved')}
        </Button>
      </div>
    </div>
  );
}

/** Enrolment: QR code, first code, then the backup codes. */
export function TwoFactorSetup({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [setup, setSetup] = useState<{
    secret: string;
    otpauthUrl: string;
  } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const t = useTranslations('auth.setup');

  useEffect(() => {
    let cancelled = false;
    api<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', {
      method: 'POST',
    })
      .then(async (s) => {
        const image = await QRCode.toDataURL(s.otpauthUrl, {
          margin: 1,
          width: 200,
          errorCorrectionLevel: 'M',
        });
        if (cancelled) return;
        setSetup(s);
        setQr(image);
      })
      .catch(
        (err) =>
          !cancelled &&
          setError(err instanceof Error ? err.message : t('setupError'))
      );
    return () => {
      cancelled = true;
    };
  }, [t]);

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await api<{ recoveryCodes: string[] }>(
        '/auth/2fa/enable',
        {
          method: 'POST',
          body: JSON.stringify({ code }),
        }
      );
      setCodes(result.recoveryCodes);
      toast.success(t('enabled'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invalid'));
    } finally {
      setPending(false);
    }
  };

  if (codes) return <RecoveryCodes codes={codes} onDone={onDone} />;
  if (!setup) {
    return error ? (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    ) : (
      <IconSpinner className="text-muted-foreground mx-auto size-5 animate-spin" />
    );
  }

  return (
    <form onSubmit={confirm} className="@container grid gap-5">
      <div className="grid gap-5 @lg:grid-cols-[200px_1fr]">
        <div className="grid justify-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr ?? ''}
            alt={t('qrAlt')}
            className="size-[200px] rounded-lg border bg-white p-1"
          />
        </div>
        <div className="grid content-start gap-4">
          <ol className="grid gap-1.5 text-sm">
            <li>
              <strong>1.</strong> {t('step1')}
            </li>
            <li>
              <strong>2.</strong> {t('step2')}
            </li>
          </ol>
          <Field>
            <FieldLabel>{t('manualKey')}</FieldLabel>
            <code dir="ltr" className="bg-muted rounded-md px-2 py-1.5 text-xs break-all">
              {setup.secret.match(/.{1,4}/g)?.join(' ')}
            </code>
          </Field>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="enable-code">{t('code')}</FieldLabel>
            <Input
              id="enable-code"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="w-40 text-center font-mono tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <FieldError errors={error ? [{ message: error }] : []} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || code.length !== 6}>
              {pending && <IconSpinner className="animate-spin" />} {t('enable')}
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t('cancel')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
