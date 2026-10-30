const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `id` can be stored in a uuid column (anything else names no row). */
export const isUuid = (id: string) => UUID.test(id);
