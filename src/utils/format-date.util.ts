// Without a time zone the date shows in the runtime's own: the viewer's in a front component.
export const formatDate = (iso: string | null, timeZone?: string): string | null => {
  const date = iso === null ? null : new Date(iso);

  return date === null || Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
};
