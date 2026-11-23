import { describe, it, expect } from "vitest";
import { zohoAddrText, zohoAddrId, matchContactToClient, planContact, planClientSync, resolveLocationId } from "../src/client_sync";

describe("zohoAddrText / zohoAddrId", () => {
  it("composes a one-line address", () => {
    expect(zohoAddrText({ address: "Manyata EGL", city: "Bengaluru", state: "KA", zip: "560045", country: "India" }))
      .toBe("Manyata EGL, Bengaluru, KA 560045, India");
  });
  it("reads the address id defensively", () => {
    expect(zohoAddrId({ address_id: "a1" })).toBe("a1");
    expect(zohoAddrId({})).toBe("");
  });
});

describe("matchContactToClient", () => {
  const clients = [
    { id: "c1", name: "Acme Foods", zoho_contact_id: null },
    { id: "c2", name: "ServiceNow India", legal_name: null, zoho_contact_id: "z-sn" },
  ];
  it("matches by zoho_contact_id first", () => {
    expect(matchContactToClient({ zoho_contact_id: "z-sn", name: "ServiceNow Software Dev" }, clients)?.id).toBe("c2");
  });
  it("falls back to normalized name", () => {
    expect(matchContactToClient({ zoho_contact_id: "x", name: "acme  foods" }, clients)?.id).toBe("c1");
  });
  it("returns null when nothing matches", () => {
    expect(matchContactToClient({ zoho_contact_id: "x", name: "Globex" }, clients)).toBe(null);
  });
});

describe("planContact", () => {
  const contact = {
    zoho_contact_id: "z-sn", name: "ServiceNow Software Development India Pvt Ltd", gstin: "29AAA",
    billing_address: "Manyata EGL",
    addresses: [
      { zoho_address_id: "a1", label: "Manyata EGL", address_text: "Manyata, Bengaluru" },
      { zoho_address_id: "a2", label: "Bagmane", address_text: "Bagmane, Bengaluru" },
    ],
  };
  it("flags a name change and marks matched/new locations", () => {
    const p = planContact(contact, { id: "c2", name: "ServiceNow India", zoho_contact_id: "z-sn" },
      [{ id: "loc1", zoho_address_id: "a1", display_name: "ServiceNow · Manyata EGL" }]);
    expect(p.status).toBe("matched");
    expect(p.client_id).toBe("c2");
    expect(p.name_differs).toBe(true);
    expect(p.current_name).toBe("ServiceNow India");
    const a1 = p.locations.find(l => l.zoho_address_id === "a1")!;
    const a2 = p.locations.find(l => l.zoho_address_id === "a2")!;
    expect(a1.state).toBe("existing");
    expect(a1.existing_location_id).toBe("loc1");
    expect(a2.state).toBe("new");
    expect(a2.display_name).toContain("Bagmane");
  });
  it("treats an unmatched contact as new with all locations new", () => {
    const p = planContact(contact, null, []);
    expect(p.status).toBe("new");
    expect(p.client_id).toBe(null);
    expect(p.name_differs).toBe(false);
    expect(p.locations.every(l => l.state === "new")).toBe(true);
  });
  it("no name change when names match after normalization", () => {
    const p = planContact({ zoho_contact_id: "z", name: "Acme  Foods", addresses: [] },
      { id: "c1", name: "acme foods" }, []);
    expect(p.name_differs).toBe(false);
  });
});

describe("resolveLocationId", () => {
  const locs = [
    { id: "l1", zoho_address_id: "a1", shipping_address: "Manyata, Bengaluru", is_default: 1 },
    { id: "l2", zoho_address_id: "a2", shipping_address: "Bagmane, Bengaluru", is_default: 0 },
  ];
  it("matches by zoho address id first", () => {
    expect(resolveLocationId("a2", "whatever", locs)).toBe("l2");
  });
  it("falls back to normalized address text", () => {
    expect(resolveLocationId(null, "bagmane,  bengaluru", locs)).toBe("l2");
  });
  it("falls back to the default location", () => {
    expect(resolveLocationId("zzz", "nowhere", locs)).toBe("l1");
  });
  it("null when the client has no locations", () => {
    expect(resolveLocationId("a1", "x", [])).toBe(null);
  });
});

describe("planClientSync", () => {
  it("plans each contact against clients + their locations", () => {
    const out = planClientSync(
      [
        { zoho_contact_id: "z-sn", name: "ServiceNow Pvt Ltd", addresses: [{ zoho_address_id: "a1", address_text: "X" }] },
        { zoho_contact_id: "z-new", name: "Globex", addresses: [] },
      ],
      [{ id: "c2", name: "ServiceNow", zoho_contact_id: "z-sn" }],
      { c2: [] },
    );
    expect(out.length).toBe(2);
    expect(out[0].status).toBe("matched");
    expect(out[1].status).toBe("new");
  });
});
