import { createAssinafyClientFactory } from 'src/assinafy-client/create-assinafy-client-factory';
import { ASSINAFY_API_BASE_URL } from 'src/constants/assinafy';
import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';

export const createAssinafyClient: CreateAssinafyClient = createAssinafyClientFactory(ASSINAFY_API_BASE_URL);
