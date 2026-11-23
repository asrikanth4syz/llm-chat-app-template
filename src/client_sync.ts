// Pure logic for the Zoho contact -> SmartPantry client sync review (Phase 2).
// No env/DB/network here: it turns a snapshot of Zoho contacts + the current clients
// and locations into a set of proposals (match, name change, location upserts) that the
// review screen shows and the apply endpoint carries out. Read-only to Zoho.
import { normName } from "./zoho_dc_import";

export interface ZohoAddress { zoho_address_id?: string; label?: string; address_text?: string; }
export interface ZohoContact {
  zoho_contact_id: string; name: string; gstin?: string; billing_address?: string; addresses?: ZohoAddress[];
}
export interface ClientRow { id: string; name?: string; legal_name?: string; display_name?: string; zoho_contact_id?: string | null; }
export interface ExistingLocation { id: string; zoho_address_id?: string | null; display_name?: string; }

// Compose a one-line address from a Zoho address object (defensive to field spellings).
export function zohoAddrText(a: Record<string, unknown> | null | undefined): string {
  if (!a) return "";
  const g = (k: string) => { const v = (a as Record<string, unknown>)[k]; return v == null ? "" : String(v).trim(); };
  const cityLine = [g("city"), [g("state"), g("zip")].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [g("attention"), g("address"), g("street2"), cityLine, g("country")].filter(Boolean).join(", ");
}
export function zohoAddrId(a: Record<string, unknown> | null | undefined): string {
  if (!a) return "";
  return String((a as Record<string, unknown>).address_id ?? (a as Record<string, unknown>).zoho_address_id ?? "").trim();
}

// Match a Zoho contact to an existing client: first by zoho_contact_id, then by a
// normalized name against the client's name / legal_name / display_name.
export function matchContactToClient(contact: ZohoContact, clients: ClientRow[]): ClientRow | null {
  const byId = clients.find(c => c.zoho_contact_id && String(c.zoho_contact_id) === String(contact.zoho_contact_id));
  if (byId) return byId;
  const cn = normName(contact.name);
  if (!cn) return null;
  return clients.find(c => [c.name, c.legal_name, c.display_name].some(v => v && normName(v) === cn)) || null;
}

export type SyncStatus = "matched" | "new";
export interface LocationProposal {
  zoho_address_id: string; display_name: string; shipping_address: string; state: "new" | "existing";
  existing_location_id?: string;
}
export interface ContactProposal {
  zoho_contact_id: string;
  status: SyncStatus;
  client_id: string | null;
  current_name: string | null;
  zoho_name: string;
  name_differs: boolean;        // true when a Keep/Replace decision is offered
  gstin: string | null;
  billing_address: string | null;
  locations: LocationProposal[];
}

export function planContact(contact: ZohoContact, client: ClientRow | null, existing: ExistingLocation[]): ContactProposal {
  const byAddr = new Map<string, ExistingLocation>();
  for (const l of existing || []) if (l.zoho_address_id) byAddr.set(String(l.zoho_address_id), l);
  const locations: LocationProposal[] = (contact.addresses || []).map(a => {
    const aid = String(a.zoho_address_id || "");
    const hit = aid ? byAddr.get(aid) : undefined;
    const label = (a.label || "").trim();
    return {
      zoho_address_id: aid,
      display_name: hit?.display_name || `${contact.name}${label ? " · " + label : ""}`,
      shipping_address: a.address_text || "",
      state: hit ? "existing" : "new",
      ...(hit ? { existing_location_id: hit.id } : {}),
    };
  });
  const current = client ? String(client.name || "") : null;
  const nameDiffers = !!client && normName(current) !== normName(contact.name) && !!contact.name.trim();
  return {
    zoho_contact_id: contact.zoho_contact_id,
    status: client ? "matched" : "new",
    client_id: client ? client.id : null,
    current_name: current,
    zoho_name: contact.name,
    name_differs: nameDiffers,
    gstin: contact.gstin || null,
    billing_address: contact.billing_address || null,
    locations,
  };
}

export function planClientSync(
  contacts: ZohoContact[], clients: ClientRow[], locationsByClient: Record<string, ExistingLocation[]>,
): ContactProposal[] {
  return (contacts || []).map(z => {
    const client = matchContactToClient(z, clients);
    const existing = client ? (locationsByClient[client.id] || []) : [];
    return planContact(z, client, existing);
  });
}
