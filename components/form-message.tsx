export function FormMessage({ error }: { error?: string }) {
  return error ? <p className="form-error" role="alert">{error}</p> : null;
}
