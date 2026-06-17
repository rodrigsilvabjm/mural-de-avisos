import { Controller, Get } from '@nestjs/common';
import { SignageService } from './signage.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly signage: SignageService) {}

  @Get()
  listAudit() {
    return this.signage.listAudit();
  }
}
