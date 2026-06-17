import { Body, Controller, Get, Post } from '@nestjs/common';
import { EmergencyDto } from './dto';
import { SignageGateway } from './signage.gateway';
import { SignageService } from './signage.service';

@Controller('emergency')
export class EmergencyController {
  constructor(
    private readonly signage: SignageService,
    private readonly gateway: SignageGateway,
  ) {}

  @Get()
  getEmergency() {
    return this.signage.getEmergency();
  }

  @Post()
  setEmergency(@Body() dto: EmergencyDto) {
    const emergency = this.signage.setEmergency(dto);
    this.gateway.broadcastEmergency(emergency);
    return emergency;
  }
}
