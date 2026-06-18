import { headers } from 'next/headers';
import { LitePlayerPage, shouldUseLitePlayer } from '../../../components/LitePlayerPage';
import { PlayerScreen } from '../../../components/PlayerScreen';
import { api } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function PlayerPage({ params }: { params: { code: string } }) {
  const payload = await api.player(params.code);
  const userAgent = headers().get('user-agent') ?? '';
  if (shouldUseLitePlayer(userAgent)) {
    return <LitePlayerPage code={params.code} payload={payload} />;
  }
  return <PlayerScreen code={params.code} initialPayload={payload} />;
}
