import { PlayerScreen } from '../../../components/PlayerScreen';
import { api } from '../../../lib/api';

export default async function PlayerPage({ params }: { params: { code: string } }) {
  const payload = await api.player(params.code);
  return <PlayerScreen code={params.code} initialPayload={payload} />;
}
