export function classNames(...args: Array<string | boolean | undefined | null>) {
  return args.filter(Boolean).join(" ");
}

export function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
