import { NextFunction, Request, Response, Router } from 'express';
import {
  TencentVectorDbCollectionRequest,
  TencentVectorDbCreateCollectionRequest,
  TencentVectorDbConnectRequest,
  TencentVectorDbTestRequest,
} from './tcvectordb.service';
import {
  TencentVectorDbCollectionDto,
  TencentVectorDbConnectionDto,
  TencentVectorDbCreateCollectionDto,
  TencentVectorDbConnectDto,
} from './dto';
import { dtoValidationMiddleware } from '../middleware/validation';
import { getVectorDbProvider } from '../providers';

export class TencentVectorDbController {
  private readonly router = Router();
  private readonly service = getVectorDbProvider('tcvectordb');

  generateRoutes() {
    this.router.post(
      '/connect',
      dtoValidationMiddleware(TencentVectorDbConnectDto),
      this.connect.bind(this)
    );
    this.router.post(
      '/test',
      dtoValidationMiddleware(TencentVectorDbConnectionDto),
      this.testConnection.bind(this)
    );
    this.router.post(
      '/collections/list',
      dtoValidationMiddleware(TencentVectorDbCollectionDto),
      this.listCollections.bind(this)
    );
    this.router.post(
      '/collections/create',
      dtoValidationMiddleware(TencentVectorDbCreateCollectionDto),
      this.createCollection.bind(this)
    );
    return this.router;
  }

  async connect(
    req: Request<{}, {}, TencentVectorDbConnectRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      res.send(await this.service.connect(req.body));
    } catch (error) {
      next(error);
    }
  }

  async testConnection(
    req: Request<{}, {}, TencentVectorDbTestRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      res.send(await this.service.testConnection(req.body));
    } catch (error) {
      next(error);
    }
  }

  async listCollections(
    req: Request<{}, {}, TencentVectorDbCollectionRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      res.send({ collections: await this.service.listCollections(req.body) });
    } catch (error) {
      next(error);
    }
  }

  async createCollection(
    req: Request<{}, {}, TencentVectorDbCreateCollectionRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      res.send(await this.service.createCollection(req.body));
    } catch (error) {
      next(error);
    }
  }
}
