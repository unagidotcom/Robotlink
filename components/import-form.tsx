"use client";

import { useActionState } from "react";
import { previewImportAction, type ActionState } from "@/app/actions";
import { SubmitButton } from "./submit-button";
import { FormMessage } from "./form-message";

export function ImportForm({ agencyId, clients }: { agencyId: string; clients: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState<ActionState, FormData>(previewImportAction, {});
  return <form action={action} className="form grid-form">
    <input type="hidden" name="agencyId" value={agencyId} />
    <label>Client<select name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
    <label>CSV file<input name="file" type="file" accept=".csv,text/csv" required /></label>
    <div className="span-2 mapping"><h3>Column mapping</h3><p>Enter the exact header used by your file. Only URL is required.</p></div>
    <label>URL header<input name="mapUrl" defaultValue="url" required /></label>
    <label>Title header<input name="mapTitle" defaultValue="title" /></label>
    <label>Description header<input name="mapDescription" defaultValue="description" /></label>
    <label>Publication date header<input name="mapPublishedAt" defaultValue="published_at" /></label>
    <label>Keywords header<input name="mapKeywords" defaultValue="keywords" /></label>
    <label>Country header<input name="mapCountry" defaultValue="country" /></label>
    <label>Language header<input name="mapLanguage" defaultValue="language" /></label>
    <label>Device header<input name="mapDevice" defaultValue="device" /></label>
    <label>Publication status header<input name="mapPublicationStatus" defaultValue="publication_status" /></label>
    <div className="span-2"><FormMessage error={state.error} /><SubmitButton>Validate and preview</SubmitButton></div>
  </form>;
}
