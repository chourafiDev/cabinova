import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gt, sql, sum } from 'drizzle-orm';
import { type AuditActor, writeAudit } from '../audit/audit.js';
import {
  type Database,
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  creditNotes,
  invoicePayments,
  invoices,
  platformUsers,
  tenants,
} from '../database/schema/index.js';
import { EmailService } from '../email/email.service.js';
import { PlatformConfigService } from '../settings/platform-config.service.js';
import type { IssueCreditNoteDto } from './dto.js';

/**
 * Avoirs (credit notes) on paid invoices: a refund sent back by transfer,
 * or a credit deducted from the cabinet's next invoices (BillingService
 * consumes it when invoicing). The invoice itself never changes, except
 * becoming "refunded" once fully refunded.
 */
@Injectable()
export class CreditNotesService {
  private readonly logger = new Logger(CreditNotesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly email: EmailService,
    private readonly platform: PlatformConfigService,
  ) {}

  async issue(invoiceId: string, actor: AuditActor, dto: IssueCreditNoteDto) {
    if (dto.kind === 'refund' && !dto.refundedAt) {
      throw new BadRequestException({
        code: 'REFUND_DATE_REQUIRED',
        message: 'Indiquez la date du virement de remboursement.',
      });
    }
    const note = await this.database.db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .for('update');
      if (!invoice) throw new NotFoundException('Facture introuvable.');
      if (invoice.status !== 'paid') {
        throw new ConflictException({
          code: 'INVOICE_NOT_PAID',
          message:
            'Un avoir ne s’émet que sur une facture payée. Une facture impayée s’annule.',
        });
      }
      const available = await this.available(tx, invoiceId);
      if (dto.amount > available) {
        throw new BadRequestException({
          code: 'AMOUNT_TOO_HIGH',
          message: `Au plus ${(available / 100).toFixed(2)} MAD (payé et pas encore crédité).`,
        });
      }
      const now = new Date();
      const [{ n }] = await tx
        .execute<{ n: string }>(
          sql`select nextval('credit_note_number_seq') as n`,
        )
        .then((r) => r.rows);
      const [created] = await tx
        .insert(creditNotes)
        .values({
          number: `A-${now.getUTCFullYear()}-${String(n).padStart(6, '0')}`,
          invoiceId,
          tenantId: invoice.tenantId,
          kind: dto.kind,
          amount: dto.amount,
          remaining: dto.kind === 'credit' ? dto.amount : 0,
          reason: dto.reason,
          refundedAt: dto.refundedAt ? new Date(dto.refundedAt) : null,
          refundReference: dto.refundReference ?? null,
          issuedBy: actor.userId,
        })
        .returning();
      // Everything paid has been sent back: the invoice reads "Remboursée".
      const [{ refunded }] = await tx
        .select({ refunded: sum(creditNotes.amount).mapWith(Number) })
        .from(creditNotes)
        .where(
          and(
            eq(creditNotes.invoiceId, invoiceId),
            eq(creditNotes.kind, 'refund'),
          ),
        );
      if (refunded >= (await this.paid(tx, invoiceId))) {
        await tx
          .update(invoices)
          .set({ status: 'refunded' })
          .where(eq(invoices.id, invoiceId));
      }
      await writeAudit(tx, actor, {
        action: 'billing.credit_note.issue',
        entity: 'invoice',
        entityId: invoiceId,
        tenantId: invoice.tenantId,
        metadata: {
          creditNote: created.number,
          invoice: invoice.number,
          kind: dto.kind,
          amount: dto.amount,
          reason: dto.reason,
        },
      });
      return { ...created, invoiceNumber: invoice.number };
    });
    await this.notify(note);
    return note;
  }

  /** The cabinet's avoirs and its credit still to deduct. */
  async forTenant(tenantId: string) {
    const db = this.database.db;
    const [notes, [balance]] = await Promise.all([
      db
        .select({
          id: creditNotes.id,
          number: creditNotes.number,
          kind: creditNotes.kind,
          amount: creditNotes.amount,
          remaining: creditNotes.remaining,
          reason: creditNotes.reason,
          refundedAt: creditNotes.refundedAt,
          refundReference: creditNotes.refundReference,
          createdAt: creditNotes.createdAt,
          invoiceId: creditNotes.invoiceId,
          invoiceNumber: invoices.number,
          issuedBy: platformUsers.name,
        })
        .from(creditNotes)
        .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
        .leftJoin(platformUsers, eq(platformUsers.id, creditNotes.issuedBy))
        .where(eq(creditNotes.tenantId, tenantId))
        .orderBy(desc(creditNotes.createdAt)),
      db
        .select({ value: sum(creditNotes.remaining).mapWith(Number) })
        .from(creditNotes)
        .where(
          and(eq(creditNotes.tenantId, tenantId), gt(creditNotes.remaining, 0)),
        ),
    ]);
    return { notes, creditBalance: balance?.value ?? 0 };
  }

  /** Avoirs of one invoice, and how much can still be credited. */
  async forInvoice(invoiceId: string) {
    const db = this.database.db;
    const notes = await db
      .select({
        id: creditNotes.id,
        number: creditNotes.number,
        kind: creditNotes.kind,
        amount: creditNotes.amount,
        remaining: creditNotes.remaining,
        reason: creditNotes.reason,
        refundedAt: creditNotes.refundedAt,
        refundReference: creditNotes.refundReference,
        createdAt: creditNotes.createdAt,
        issuedBy: platformUsers.name,
      })
      .from(creditNotes)
      .leftJoin(platformUsers, eq(platformUsers.id, creditNotes.issuedBy))
      .where(eq(creditNotes.invoiceId, invoiceId))
      .orderBy(desc(creditNotes.createdAt));
    return { notes, creditable: await this.available(db, invoiceId) };
  }

  private async paid(tx: Database | Transaction, invoiceId: string) {
    const [row] = await tx
      .select({ total: sum(invoicePayments.amount).mapWith(Number) })
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoiceId));
    return row?.total ?? 0;
  }

  /** Paid by transfer minus avoirs already issued. */
  private async available(tx: Database | Transaction, invoiceId: string) {
    const [row] = await tx
      .select({ total: sum(creditNotes.amount).mapWith(Number) })
      .from(creditNotes)
      .where(eq(creditNotes.invoiceId, invoiceId));
    return Math.max(0, (await this.paid(tx, invoiceId)) - (row?.total ?? 0));
  }

  private async notify(note: {
    tenantId: string;
    number: string;
    kind: 'refund' | 'credit';
    amount: number;
    reason: string;
    invoiceNumber: string;
  }) {
    try {
      const { cabinets } = await this.platform.get('notifications');
      if (!cabinets.paymentReceipt) return;
      const [tenant] = await this.database.db
        .select()
        .from(tenants)
        .where(eq(tenants.id, note.tenantId));
      if (!tenant) return;
      await this.email.sendCreditNote({
        email: tenant.email,
        name: tenant.responsibleName,
        tenantName: tenant.name,
        ...note,
      });
    } catch (err) {
      this.logger.error(`Credit note ${note.number} e-mail failed`, err);
    }
  }
}
