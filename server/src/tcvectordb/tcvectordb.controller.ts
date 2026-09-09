import { NextFunction, Request, Response, Router } from 'express';
import { TencentVectorDbService, TencentVectorDbTestRequest } from './tcvectordb.service';

export class TencentVectorDbController {
  private readonly router = Router();
  private readonly service = new TencentVectorDbService();

  generateRoutes() {
    this.router.post('/test', this.testConnection.bind(this));
    return this.router;
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
}
