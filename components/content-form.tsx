"use client";

import { useActionState } from "react";
import { createContentAction, updateContentAction, type ActionState } from "@/app/actions";
import { SubmitButton } from "./submit-button";
import { FormMessage } from "./form-message";

interface ContentFormProps {
  agencyId: string;
  clients: Array<{ id: string; name: string; defaultCountryCode: string | null; defaultLanguageCode: string | null; defaultDevice: "DESKTOP" | "MOBILE" }>;
  content?: {
    id: string; clientId: string; originalUrl: string; title: string | null; description: string | null;
    publishedAt: Date | null; publisherAccountId: string | null; publicationStatus: string;
    keywords: Array<{ countryCode: string; languageCode: string; device: "DESKTOP" | "MOBILE"; keyword: { displayPhrase: string } }>;
  };
}

export function ContentForm({ agencyId, clients, content }: ContentFormProps) {
  const action = content ? updateContentAction.bind(null, content.id) : createContentAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const firstTarget = content?.keywords[0];
  return <form action={formAction} className="form grid-form">
    <input type="hidden" name="agencyId" value={agencyId} />
    <label>Client<select name="clientId" defaultValue={content?.clientId} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
    <label>Publication status<select name="publicationStatus" defaultValue={content?.publicationStatus ?? "UNKNOWN"}><option>UNKNOWN</option><option>DRAFT</option><option>PUBLISHED</option><option>UNPUBLISHED</option><option>REMOVED</option></select></label>
    <label className="span-2">Content URL<input name="originalUrl" type="url" defaultValue={content?.originalUrl} maxLength={4096} required /></label>
    <label className="span-2">Title<input name="title" defaultValue={content?.title ?? ""} maxLength={500} /></label>
    <label className="span-2">Description<textarea name="description" defaultValue={content?.description ?? ""} maxLength={5000} rows={4} /></label>
    <label>Publication date<input name="publishedAt" type="date" defaultValue={content?.publishedAt?.toISOString().slice(0, 10) ?? ""} /></label>
    <label>Publisher account ID<input name="publisherAccountId" defaultValue={content?.publisherAccountId ?? ""} placeholder="Optional UUID" /></label>
    <label className="span-2">Target keywords<textarea name="keywords" defaultValue={content?.keywords.map((item) => item.keyword.displayPhrase).join("; ") ?? ""} placeholder="keyword one; keyword two" rows={3} /></label>
    <label>Country<input name="countryCode" defaultValue={firstTarget?.countryCode ?? clients[0]?.defaultCountryCode ?? "US"} pattern="[A-Za-z]{2}" required /></label>
    <label>Language<input name="languageCode" defaultValue={firstTarget?.languageCode ?? clients[0]?.defaultLanguageCode ?? "en"} required /></label>
    <label>Device<select name="device" defaultValue={firstTarget?.device ?? clients[0]?.defaultDevice ?? "DESKTOP"}><option>DESKTOP</option><option>MOBILE</option></select></label>
    <div className="span-2"><p className="form-note">Platform and content type are identified from the URL. Evidence statuses remain unchanged and default to Unknown.</p><FormMessage error={state.error} /><SubmitButton>{content ? "Save content" : "Add content"}</SubmitButton></div>
  </form>;
}
