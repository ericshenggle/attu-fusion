import { Router } from 'express';
import { EmbeddingService } from './embedding.service';
import { embeddingProviders } from './providers';

export const createEmbeddingRouter = (service: EmbeddingService) => {
  const router = Router();
  router.get('/providers', (_req, res) => res.send(service.listProviders()));
  router.post('/generate', async (req, res, next) => {
    try {
      res.send(await service.generate(req.body));
    } catch (error) {
      next(error);
    }
  });
  return router;
};

export const router = createEmbeddingRouter(
  new EmbeddingService(embeddingProviders)
);
