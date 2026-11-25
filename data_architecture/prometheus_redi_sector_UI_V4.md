# Sector selection — V4 backend and UI contract

The client provided 74 Munich postcodes in [sector.xlsx](https://docs.google.com/spreadsheets/d/19O6h1wt6HGn9pkyEBNH0zLnDBU7_sp5n/edit). Their four sector labels are retained exactly: `North`, `South`, `East`, `West`.

Natalia confirmed on 25 November 2026 that V4 keeps the Munich-only restriction. `members.postal_code` is an optional string referencing `sectors.postal_code`. Use NULL for a missing or unsupported postcode. Unknown postcodes and empty strings are rejected. V4 cannot store the real unlisted postcode in this field.

The application must not silently discard an entered outside postcode while implying it was saved. Explain the pilot restriction in the form and align any outside-address workflow with this database contract. An unmatched value alone must not be automatically labelled `Außerhalb` without a separately agreed address-classification rule.

`members_current.sector` is derived from the saved postcode. A NULL postcode produces a NULL sector. There is no independently editable `members.sector` column. A sector dropdown may filter the postcode choices; the selected postcode determines the saved member's sector.

The backend should return the derived sector in the member response and expose the `sectors` lookup. Read the actual rows, including postcode, sector, city and country, rather than constructing an unrelated free-text sector list.

```sql
-- Sector choices.
SELECT DISTINCT sector FROM public.sectors ORDER BY sector;

-- Postcodes within the selected sector: bind $1.
SELECT code, postal_code, sector, city, country
FROM public.sectors WHERE sector=$1 ORDER BY postal_code;

-- Resolve a selected postcode: bind the postcode string.
SELECT code, postal_code, sector, city, country
FROM public.sectors WHERE postal_code=$1;

-- Return sector and the new optional member fields: bind the member UUID.
SELECT member_id, phone, landline_phone, ori_interviewer_id, postal_code, sector
FROM public.members_current WHERE member_id=$1;
```

Use the returned city/country consistently with the selected postcode. Existing member city/country columns are not automatically rewritten. All current sector rows are Munich, DE. V4 retains the globally unique postcode key only for this pilot; supporting additional countries requires a reviewed country + postcode key and member-reference design.
