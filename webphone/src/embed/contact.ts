/** Display-only CRM context. Never written to the phone's contacts or journal. */
export const contactFields = ['firstName', 'lastName', 'phone', 'email', 'company', 'address', 'city', 'country'] as const;
export type ContactField = typeof contactFields[number];
export type CustomerContact = Partial<Record<ContactField | 'id' | 'notes', string>>;
const limits: Record<keyof CustomerContact, number> = { id: 100, firstName: 100, lastName: 100, phone: 40, email: 254, company: 200, address: 400, city: 120, country: 100, notes: 2000 };
export function validContact(value: unknown): value is CustomerContact | null {
  if (value === null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, text]) => Object.hasOwn(limits, key)
    && typeof text === 'string' && text.length <= limits[key as keyof CustomerContact]);
}
export type ContactContext = { contact: CustomerContact; callId: string | null };
export function visibleContact(context: ContactContext | null, sessionOpen: boolean, callId: string | null): CustomerContact | null {
  return sessionOpen && context?.callId === callId ? context.contact : null;
}
