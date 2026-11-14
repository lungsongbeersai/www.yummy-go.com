import { apiRequest } from "@/lib/api";
import { fetchAll, saveEntity } from "@/services/shared/crud";
import type { ApiDataResponse } from "@/services/shared/types";
import type {
  CatalogItem,
  CommercialDocument,
  CommercialDocumentRevision,
  ConvertQuotationInput,
  CreateCommercialDocumentInput,
  SaveCatalogItemInput,
  UpdateCommercialDocumentInput,
} from "@/services/commercial/types";

const BASE_PATH = "/api/v1/commercial";

export function getCommercialCatalog(branchUuid: string) {
  return fetchAll<CatalogItem>(`${BASE_PATH}/catalog`, {
    branch_uuid: branchUuid,
    include_inactive: true,
  });
}

export function saveCatalogItem(input: SaveCatalogItemInput) {
  return saveEntity<CatalogItem>(`${BASE_PATH}/catalog/save`, { ...input }, undefined, Boolean(input.image));
}

export function getCommercialDocuments(branchUuid: string) {
  return fetchAll<CommercialDocument>(`${BASE_PATH}/documents`, { branch_uuid: branchUuid });
}

export async function getCommercialDocument(branchUuid: string, documentUuid: string) {
  const result = await apiRequest<ApiDataResponse<CommercialDocument>>("get", `${BASE_PATH}/documents/${encodeURIComponent(documentUuid)}`, {
    params: { branch_uuid: branchUuid },
  });
  return result.data;
}

export function createCommercialDocument(input: CreateCommercialDocumentInput) {
  return saveEntity<CommercialDocument>(`${BASE_PATH}/documents/create`, { ...input });
}

export async function updateCommercialDocument(input: UpdateCommercialDocumentInput) {
  const { document_uuid, ...data } = input;
  const result = await apiRequest<ApiDataResponse<CommercialDocument>>("post", `${BASE_PATH}/documents/${encodeURIComponent(document_uuid)}/update`, { data });
  return result.data;
}

export function getCommercialDocumentRevisions(branchUuid: string, documentUuid: string) {
  return fetchAll<CommercialDocumentRevision>(`${BASE_PATH}/documents/${encodeURIComponent(documentUuid)}/revisions`, { branch_uuid: branchUuid });
}

export async function convertQuotation(input: ConvertQuotationInput) {
  const { document_uuid, ...data } = input;
  const result = await apiRequest<ApiDataResponse<CommercialDocument>>("post", `${BASE_PATH}/documents/${encodeURIComponent(document_uuid)}/convert`, { data });
  return result.data;
}
