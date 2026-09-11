import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  IsBoolean,
  IsIn,
  IsObject,
  MinLength,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';
import type {
  ProviderDocument,
  ProviderIndex,
  ProviderReadConsistency,
} from '../providers/types';

export class TencentVectorDbConnectionDto {
  @IsString()
  @IsNotEmpty()
  readonly endpoint: string;
  @IsString()
  @IsNotEmpty()
  readonly account: string;
  @IsString()
  @IsNotEmpty()
  readonly apiKey: string;
}

export class TencentVectorDbConnectDto extends TencentVectorDbConnectionDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  readonly database?: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  readonly clientId: string;
}

export class TencentVectorDbDatabaseDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(128)
  readonly database: string;
}

export class TencentVectorDbCollectionDto extends TencentVectorDbDatabaseDto {
  @IsString()
  @Matches(/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/)
  readonly collection: string;
}

export class TencentVectorDbCreateCollectionDto extends TencentVectorDbCollectionDto {
  @IsInt()
  @Min(1)
  @Max(100)
  readonly shardNum: number;
  @IsInt()
  @Min(0)
  readonly replicaNum: number;
  @IsOptional()
  @IsString()
  @MaxLength(256)
  readonly description?: string;
  @IsArray()
  readonly indexes: ProviderIndex[];
}

export class TencentVectorDbReadDto extends TencentVectorDbCollectionDto {
  @IsOptional()
  @IsString()
  readonly filter?: string;
  @IsOptional()
  @IsBoolean()
  readonly retrieveVector?: boolean;
  @IsOptional()
  @IsIn(['strongConsistency', 'eventualConsistency'])
  readonly readConsistency?: ProviderReadConsistency;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(256)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  readonly outputFields?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(128, { each: true })
  readonly documentIds?: string[];
  @IsInt()
  @Min(1)
  @Max(16384)
  readonly limit: number;
}

export class TencentVectorDbQueryDto extends TencentVectorDbReadDto {
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  readonly offset: number;
}

export class TencentVectorDbSearchDto extends TencentVectorDbReadDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  readonly vectors?: number[][];
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  readonly embeddingItems?: string[];
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32768)
  readonly ef?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65536)
  readonly nprobe?: number;
}

export class TencentVectorDbUpsertDto extends TencentVectorDbCollectionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  readonly documents: ProviderDocument[];
  @IsBoolean()
  readonly buildIndex: boolean;
}

export class TencentVectorDbDeleteDocumentsDto extends TencentVectorDbCollectionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(128, { each: true })
  readonly documentIds: string[];
}

export class TencentVectorDbCountDto extends TencentVectorDbCollectionDto {
  @IsOptional()
  @IsString()
  readonly filter?: string;
}

export class TencentVectorDbAliasDto extends TencentVectorDbCollectionDto {
  @IsString() @Matches(/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/) readonly alias: string;
}
export class TencentVectorDbAliasDeleteDto extends TencentVectorDbDatabaseDto {
  @IsString() @Matches(/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/) readonly alias: string;
}
export class TencentVectorDbIndexRebuildDto extends TencentVectorDbCollectionDto {
  @IsString() @IsIn(['vector', 'sparse_vector']) readonly fieldName: string;
  @IsOptional() @IsBoolean() readonly dropBeforeRebuild?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(256) readonly throttle?: number;
}
export class TencentVectorDbIndexDropDto extends TencentVectorDbCollectionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(256)
  @ArrayUnique()
  @IsString({ each: true })
  readonly fieldNames: string[];
}
export class TencentVectorDbUserDto {
  @IsString() @Matches(/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/) readonly user: string;
}
export class TencentVectorDbUserPasswordDto extends TencentVectorDbUserDto {
  @IsString() @MinLength(8) @MaxLength(128) readonly password: string;
}
export class TencentVectorDbPrivilegesDto extends TencentVectorDbUserDto {
  @IsArray() @ArrayMinSize(1) readonly privileges: Array<{
    resource: string;
    actions: string[];
  }>;
}
export class TencentVectorDbHybridSearchDto extends TencentVectorDbCollectionDto {
  @IsObject() readonly search: Record<string, unknown>;
  @IsOptional()
  @IsIn(['strongConsistency', 'eventualConsistency'])
  readonly readConsistency?: ProviderReadConsistency;
}
export class TencentVectorDbFullTextSearchDto extends TencentVectorDbHybridSearchDto {}
