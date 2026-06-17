import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditController } from './audit.controller';
import { EmergencyController } from './emergency.controller';
import { SignageGateway } from './signage.gateway';
import { SignageController } from './signage.controller';
import { SignageService } from './signage.service';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AuditController, EmergencyController, SignageController],
  providers: [SignageGateway, SignageService, StorageService],
})
export class AppModule {}
