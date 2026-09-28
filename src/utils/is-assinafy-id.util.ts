import { MAX_ASSINAFY_ID_LENGTH } from 'src/constants/limits';

const ASSINAFY_ID_PATTERN = new RegExp(`^[A-Za-z0-9_-]{1,${MAX_ASSINAFY_ID_LENGTH}}$`);

export const isAssinafyId = (value: string): boolean => ASSINAFY_ID_PATTERN.test(value);
