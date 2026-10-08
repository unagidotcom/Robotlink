"use client";

import { useActionState } from "react";
import { createClientAction, type ActionState } from "@/app/actions";
import { SubmitButton } from "./submit-button";
import { FormMessage } from "./form-message";

export function ClientForm({ agencyId }: { agencyId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createClientAction, {});
  return <form action={action} className="form grid-form">
    <input type="hidden" name="agencyId" value={agencyId} />
    <label className="span-2">Client name<input name="name" maxLength={160} required /></label>
    <label>Country<input name="defaultCountryCode" defaultValue="US" pattern="[A-Za-z]{2}" required /></label>
    <label>Language<input name="defaultLanguageCode" defaultValue="en" required /></label>
    <label>Default device<select name="defaultDevice"><option>DESKTOP</option><option>MOBILE</option></select></label>
    <label>External reference<input name="externalReference" maxLength={160} /></label>
    <div className="span-2"><FormMessage error={state.error} /><SubmitButton>Create client</SubmitButton></div>
  </form>;
}
