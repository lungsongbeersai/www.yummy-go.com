import type { CreateCommercialDocumentInput } from "@/services/commercial";

export interface CommercialUpdateAttempt {
  requestUuid: string;
  payload: string | null;
}

/** Changed content needs a new operation, while identical network retries reuse it. */
export function commercialUpdateAttempt(previous: CommercialUpdateAttempt, input: CreateCommercialDocumentInput, newUuid: () => string): CommercialUpdateAttempt {
  const payload = JSON.stringify({ ...input, request_uuid: null });
  return { requestUuid: previous.payload !== null && previous.payload !== payload ? newUuid() : previous.requestUuid, payload };
}
