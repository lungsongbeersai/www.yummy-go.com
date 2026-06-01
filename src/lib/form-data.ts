export function toFormData(input: Record<string, unknown>) {
  const form = new FormData();

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach((item) => form.append(`${key}[]`, String(item)));
      return;
    }

    if (value instanceof File) {
      form.append(key, value);
      return;
    }

    form.append(key, String(value));
  });

  return form;
}
