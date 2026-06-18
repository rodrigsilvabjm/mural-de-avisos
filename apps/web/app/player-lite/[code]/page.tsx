import { LitePlayerPage } from '../../../components/LitePlayerPage';
import { api } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function PlayerLitePage({ params }: { params: { code: string } }) {
  const payload = await api.player(params.code);
  return <LitePlayerPage code={params.code} payload={payload} />;
}
