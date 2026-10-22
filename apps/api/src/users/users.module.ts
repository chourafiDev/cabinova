import { Module } from '@nestjs/common';
import {
  AccessCatalogController,
  UsersController,
} from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController, AccessCatalogController],
  providers: [UsersService],
})
export class UsersModule {}
