import { transformObjStrToJSONStr } from '@/utils';
import { DataTypeStringEnum } from '@/consts';
import type { FieldObject } from '@server/types';
import {
  isCombinedVector,
  sparseToPairs,
} from '@/components/embedding/vectors';

const floatVectorValidator = (text: string, field: FieldObject) => {
  try {
    const parsed = JSON.parse(text);
    const value = isCombinedVector(parsed) ? parsed.dense : parsed;
    if (isCombinedVector(parsed)) sparseToPairs(parsed.sparse);
    const dim = field.dimension;
    if (
      !Array.isArray(value) ||
      value.some(v => typeof v !== 'number' || !Number.isFinite(v))
    ) {
      return {
        valid: false,
        message: `Expected an array of finite numbers`,
      };
    }

    if (Array.isArray(value) && value.length !== dim) {
      return {
        valid: false,
        value: undefined,
        message: `Dimension ${value.length} is not equal to ${dim} `,
      };
    }

    return { valid: true, message: ``, value: value };
  } catch (e: any) {
    return {
      valid: false,
      message: `Wrong Float Vector format, it should be an array of ${field.dimension} numbers`,
    };
  }
};

const binaryVectorValidator = (text: string, field: FieldObject) => {
  try {
    const value = JSON.parse(text);
    const dim = field.dimension;
    if (
      !Array.isArray(value) ||
      value.some(v => !Number.isInteger(v) || v < 0 || v > 255)
    ) {
      return {
        valid: false,
        message: `Expected an array of bytes (0-255)`,
      };
    }

    if (Array.isArray(value) && value.length !== dim / 8) {
      return {
        valid: false,
        value: undefined,
        message: `Dimension ${value.length} is not equal to ${dim / 8} `,
      };
    }

    return { valid: true, message: ``, value: value };
  } catch (e: any) {
    return {
      valid: false,
      message: `Wrong Binary Vector format, it should be an array of ${
        field.dimension / 8
      } numbers`,
    };
  }
};

const sparseVectorValidator = (text: string, field: FieldObject) => {
  try {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      value = JSON.parse(transformObjStrToJSONStr(text));
    }
    sparseToPairs(value);
    return {
      valid: true,
      message: ``,
    };
  } catch (e: any) {
    return {
      valid: false,
      message: `Wrong Sparse Vector format`,
    };
  }
};

export const Validator = {
  [DataTypeStringEnum.FloatVector]: floatVectorValidator,
  [DataTypeStringEnum.BinaryVector]: binaryVectorValidator,
  [DataTypeStringEnum.Float16Vector]: floatVectorValidator,
  [DataTypeStringEnum.BFloat16Vector]: floatVectorValidator,
  [DataTypeStringEnum.SparseFloatVector]: sparseVectorValidator,
};
