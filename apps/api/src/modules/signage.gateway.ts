import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EmergencyMessage } from './models';
import { SignageService } from './signage.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SignageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly screenBySocket = new Map<string, string>();

  constructor(private readonly signage: SignageService) {}

  handleConnection() {
    return undefined;
  }

  handleDisconnect(client: Socket) {
    const code = this.screenBySocket.get(client.id);
    if (code) {
      this.signage.markOffline(code);
      this.screenBySocket.delete(client.id);
      this.server.emit('screens:changed', this.signage.listScreens());
    }
  }

  @SubscribeMessage('player:hello')
  hello(
    @MessageBody() body: { code: string; userAgent?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const screen = this.signage.markOnline(body.code, body.userAgent);
    this.screenBySocket.set(client.id, body.code);
    client.join(`screen:${body.code}`);
    this.server.emit('screens:changed', this.signage.listScreens());
    return {
      screen,
      payload: this.signage.playerPayload(body.code),
    };
  }

  broadcastRefresh() {
    this.server?.emit('content:refresh');
  }

  broadcastEmergency(message: EmergencyMessage) {
    this.server?.emit('emergency', message);
  }
}
