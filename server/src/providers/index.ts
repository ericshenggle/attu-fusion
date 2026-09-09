import { TencentVectorDbService } from '../tcvectordb/tcvectordb.service';
import { VectorDbProvider, VectorDbProviderName } from './types';

const providers: Partial<Record<VectorDbProviderName, VectorDbProvider>> = {
  tcvectordb: new TencentVectorDbService(),
};

export const getVectorDbProvider = (name: VectorDbProviderName) => {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Vector database provider is not configured: ${name}.`);
  }
  return provider;
};

export { VectorDbProvider } from './types';
