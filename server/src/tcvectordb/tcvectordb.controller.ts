import express, { NextFunction, Request, Response, Router } from 'express';
import HttpErrors from 'http-errors';
import {
  TencentVectorDbCollectionDto,
  TencentVectorDbConnectionDto,
  TencentVectorDbCreateCollectionDto,
  TencentVectorDbConnectDto,
  TencentVectorDbDatabaseDto,
  TencentVectorDbQueryDto,
  TencentVectorDbSearchDto,
  TencentVectorDbUpsertDto,
  TencentVectorDbDeleteDocumentsDto,
  TencentVectorDbCountDto,
  TencentVectorDbAliasDto,
  TencentVectorDbAliasDeleteDto,
  TencentVectorDbIndexRebuildDto,
  TencentVectorDbIndexDropDto,
  TencentVectorDbUserDto,
  TencentVectorDbUserPasswordDto,
  TencentVectorDbPrivilegesDto,
  TencentVectorDbHybridSearchDto,
  TencentVectorDbFullTextSearchDto,
} from './dto';
import { dtoValidationMiddleware } from '../middleware/validation';
import { getVectorDbProvider } from '../providers';

export class TencentVectorDbController {
  private readonly router = Router();
  private readonly service = getVectorDbProvider('tcvectordb');

  private handle(action: (req: Request) => unknown) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.send(await action(req));
      } catch (error) {
        next(error);
      }
    };
  }

  generateRoutes() {
    this.router.post(
      '/connect',
      dtoValidationMiddleware(TencentVectorDbConnectDto),
      this.handle(req => this.service.connect(req.body))
    );
    this.router.post(
      '/test',
      dtoValidationMiddleware(TencentVectorDbConnectionDto),
      this.handle(req => this.service.testConnection(req.body))
    );
    this.router.use((req, res, next) => {
      if (!this.service.hasSession(req.clientId)) {
        next(
          HttpErrors(401, 'TCVectordb connection expired, please reconnect.')
        );
      } else {
        next();
      }
    });
    this.router.post(
      '/disconnect',
      this.handle(req => {
        this.service.disconnect(req.clientId);
        return { code: 0 };
      })
    );
    this.router.get(
      '/databases',
      this.handle(req => this.service.listDatabases(req.clientId))
    );
    this.router.post(
      '/collections/list',
      dtoValidationMiddleware(TencentVectorDbDatabaseDto),
      this.handle(async req => ({
        collections: await this.service.listCollections({
          ...req.body,
          clientId: req.clientId,
        }),
      }))
    );
    this.router.post(
      '/collections/describe',
      dtoValidationMiddleware(TencentVectorDbCollectionDto),
      this.handle(req =>
        this.service.describeCollection({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/collections/create',
      dtoValidationMiddleware(TencentVectorDbCreateCollectionDto),
      this.handle(req =>
        this.service.createCollection({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/collections/drop',
      dtoValidationMiddleware(TencentVectorDbCollectionDto),
      this.handle(req =>
        this.service.dropCollection({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/documents/query',
      dtoValidationMiddleware(TencentVectorDbQueryDto),
      this.handle(req =>
        this.service.queryDocuments({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/documents/search',
      dtoValidationMiddleware(TencentVectorDbSearchDto),
      this.handle(req =>
        this.service.searchDocuments({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/documents/upsert',
      dtoValidationMiddleware(TencentVectorDbUpsertDto),
      this.handle(req =>
        this.service.upsertDocuments({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/documents/import',
      // The browser streams the selected JSON file as bytes. Keep it out of
      // React state and parse it only on the backend where document validation
      // and vector validation already live.
      express.raw({ type: 'application/octet-stream', limit: '16mb' }),
      this.handle(req => {
        const { database, collection, buildIndex } = req.query;
        if (
          typeof database !== 'string' ||
          !database.trim() ||
          database.length > 128 ||
          typeof collection !== 'string' ||
          !/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(collection) ||
          (buildIndex !== 'true' && buildIndex !== 'false')
        ) {
          throw HttpErrors(400, 'Invalid import target or buildIndex option.');
        }
        if (!Buffer.isBuffer(req.body)) {
          throw HttpErrors(400, 'Upload a JSON file.');
        }
        let documents: unknown;
        try {
          documents = JSON.parse(req.body.toString('utf8'));
        } catch {
          throw HttpErrors(400, 'Invalid JSON file.');
        }
        return this.service.upsertDocuments({
          clientId: req.clientId,
          database,
          collection,
          buildIndex: buildIndex === 'true',
          documents: documents as any,
        });
      })
    );
    this.router.post(
      '/documents/delete',
      dtoValidationMiddleware(TencentVectorDbDeleteDocumentsDto),
      this.handle(req =>
        this.service.deleteDocuments({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/documents/count',
      dtoValidationMiddleware(TencentVectorDbCountDto),
      this.handle(req =>
        this.service.countDocuments({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/databases/create',
      dtoValidationMiddleware(TencentVectorDbDatabaseDto),
      this.handle(req =>
        this.service.createDatabase({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/databases/drop',
      dtoValidationMiddleware(TencentVectorDbDatabaseDto),
      this.handle(req =>
        this.service.dropDatabase({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/aliases/set',
      dtoValidationMiddleware(TencentVectorDbAliasDto),
      this.handle(req =>
        this.service.setAlias({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/aliases/delete',
      dtoValidationMiddleware(TencentVectorDbAliasDeleteDto),
      this.handle(req =>
        this.service.deleteAlias({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/indexes/rebuild',
      dtoValidationMiddleware(TencentVectorDbIndexRebuildDto),
      this.handle(req =>
        this.service.rebuildIndex({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/indexes/drop',
      dtoValidationMiddleware(TencentVectorDbIndexDropDto),
      this.handle(req =>
        this.service.dropIndex({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/documents/hybrid-search',
      dtoValidationMiddleware(TencentVectorDbHybridSearchDto),
      this.handle(req =>
        this.service.hybridSearch({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/documents/full-text-search',
      dtoValidationMiddleware(TencentVectorDbFullTextSearchDto),
      this.handle(req =>
        this.service.fullTextSearch({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/users/list',
      this.handle(req => this.service.listUsers(req.clientId))
    );
    this.router.post(
      '/users/create',
      dtoValidationMiddleware(TencentVectorDbUserPasswordDto),
      this.handle(req =>
        this.service.createUser({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/users/drop',
      dtoValidationMiddleware(TencentVectorDbUserDto),
      this.handle(req =>
        this.service.dropUser({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/users/describe',
      dtoValidationMiddleware(TencentVectorDbUserDto),
      this.handle(req =>
        this.service.describeUser({ ...req.body, clientId: req.clientId })
      )
    );
    this.router.post(
      '/users/grant',
      dtoValidationMiddleware(TencentVectorDbPrivilegesDto),
      this.handle(req =>
        this.service.grantUserPrivileges({
          ...req.body,
          clientId: req.clientId,
        })
      )
    );
    this.router.post(
      '/users/revoke',
      dtoValidationMiddleware(TencentVectorDbPrivilegesDto),
      this.handle(req =>
        this.service.revokeUserPrivileges({
          ...req.body,
          clientId: req.clientId,
        })
      )
    );
    this.router.post(
      '/users/change-password',
      dtoValidationMiddleware(TencentVectorDbUserPasswordDto),
      this.handle(req =>
        this.service.changeUserPassword({ ...req.body, clientId: req.clientId })
      )
    );
    return this.router;
  }
}
