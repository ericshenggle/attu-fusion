import { IsNotEmpty, IsString } from 'class-validator';

export class TencentVectorDbConnectionDto {
  @IsString({ message: 'endpoint must be a string.' })
  @IsNotEmpty({ message: 'endpoint is required.' })
  readonly endpoint: string;

  @IsString({ message: 'account must be a string.' })
  @IsNotEmpty({ message: 'account is required.' })
  readonly account: string;

  @IsString({ message: 'apiKey must be a string.' })
  @IsNotEmpty({ message: 'apiKey is required.' })
  readonly apiKey: string;
}

export class TencentVectorDbCollectionDto extends TencentVectorDbConnectionDto {
  @IsString({ message: 'database must be a string.' })
  @IsNotEmpty({ message: 'database is required.' })
  readonly database: string;
}

export class TencentVectorDbCreateCollectionDto extends TencentVectorDbCollectionDto {
  @IsString({ message: 'collection must be a string.' })
  @IsNotEmpty({ message: 'collection is required.' })
  readonly collection: string;
}
