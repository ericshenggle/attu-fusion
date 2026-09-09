import { TencentVectorDbController } from './tcvectordb.controller';

const controller = new TencentVectorDbController();
export const router = controller.generateRoutes();
