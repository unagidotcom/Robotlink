"use client";

import { useActionState, useState } from "react";
import { previewPastedUrlsAction, type ActionState } from "@/app/actions";
import { MAX_PASTED_URLS } from "@/lib/imports/constants";
import { SubmitButton } from "./submit-button";
import { FormMessage } from "./form-message";

export function PasteUrlForm({ agencyId, clients }: { agencyId: string; clients: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState<ActionState, FormData>(previewPastedUrlsAction, {});
  const [urls, setUrls] = useState("");
  const count = urls.split(/\r?\n/).filter((url) => url.trim()).length;

  return <form action={action} className="form grid-form">
    <input type="hidden" name="agencyId" value={agencyId} />
    <label className="span-2">Client<select name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
    <label className="span-2">URLs<textarea name="urls" rows={10} value={urls} onChange={(event) => setUrls(event.target.value)} placeholder={"https://example.com/article-one\nhttps://medium.com/@publisher/article-two"} required /></label>
    <div className="span-2 input-summary" aria-live="polite"><span>{count} URL{count === 1 ? "" : "s"} entered</span><span className={count > MAX_PASTED_URLS ? "over-limit" : ""}>{MAX_PASTED_URLS} maximum</span></div>
    <div className="span-2"><FormMessage error={state.error} /><SubmitButton>Validate and preview</SubmitButton></div>
  </form>;
}
