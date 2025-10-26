export type ContactState = {
    ok: boolean;
    message?: string;
    fields?: Partial<Record<"name"|"email"|"role"|"topic"|"message", string>>;
    errors?: Partial<Record<"name"|"email"|"role"|"topic"|"message", string>>;
};
