import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { normalizeQuery } from './match.js';
import { SearchService } from './search.service.js';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** GET /search?q=atlas — grouped results the user may open; {} below 2 characters. */
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get()
  find(@Query('q') q: string | undefined, @CurrentUser() user: AuthUser) {
    const term = normalizeQuery(typeof q === 'string' ? q : undefined);
    return term ? this.search.search(term, user) : {};
  }
}
