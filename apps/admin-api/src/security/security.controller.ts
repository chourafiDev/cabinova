import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermissions } from '../auth/decorators.js';
import { AUDIT_CATEGORIES } from './catalog.js';
import { AuditQuery } from './dto.js';
import { SecurityService } from './security.service.js';

const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Sécurité et conformité — the audit journal (security:read). */
@Controller('security')
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @RequirePermissions('security:read')
  @Get('summary')
  summary() {
    return this.security.summary();
  }

  @RequirePermissions('security:read')
  @Get('audit')
  journal(@Query() query: AuditQuery) {
    return this.security.journal(query);
  }

  /** Same filters as CSV (Excel, French locale: ";" and a BOM). */
  @RequirePermissions('security:read')
  @Get('audit/export.csv')
  async export(
    @Query() query: AuditQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rows = await this.security.exportRows(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cabinova-journal-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    const lines = [
      [
        'Date',
        'Catégorie',
        'Action',
        'Sensible',
        'Auteur',
        'IP',
        'Cabinet',
        'Détails',
      ],
      ...rows.map((r) => [
        r.createdAt.toISOString(),
        r.category ? AUDIT_CATEGORIES[r.category].label : '',
        r.action,
        r.sensitive ? 'oui' : '',
        r.actor ? `${r.actor.name} <${r.actor.email}>` : 'Système / inconnu',
        r.ip,
        r.tenant?.name,
        r.metadata ? JSON.stringify(r.metadata) : '',
      ]),
    ];
    return `﻿${lines.map((l) => l.map(cell).join(';')).join('\r\n')}\r\n`;
  }
}
