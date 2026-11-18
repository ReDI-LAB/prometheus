# Sector selection for the member form

Added to the Version 3 installer and Excel specification on 18 November 2026. This changes the files; it does not upgrade an already installed database.

## Source and storage

The client supplied [sector.xlsx](https://docs.google.com/spreadsheets/d/19O6h1wt6HGn9pkyEBNH0zLnDBU7_sp5n/edit), containing 74 Munich postal codes mapped to four English sector labels: `North`, `South`, `East`, `West`. The supplied mappings are retained exactly. They have not been independently checked against a municipal publication.

`public.sectors` contains `code`, `postal_code`, `sector`, `city`, `country`. The source code (for example, `DE-80333`) is the primary key. `postal_code` is unique and is stored as text. `country` references `countries.code`.

`members.postal_code` references `sectors.postal_code`. It remains optional. An unknown or empty-string postal code is rejected. Send SQL `NULL` / JSON `null` for an omitted value. There is no new editable `members.sector` column. `members_current.sector` exposes the sector derived from the saved postal code and is `NULL` when the postal code is `NULL`.

## UI behaviour

1. The form can show a sector dropdown containing the four labels.
2. Selecting a sector filters the available postal codes. Select the member's actual postal code before saving the location.
3. Alternatively, selecting or entering a known postal code automatically shows its sector.
4. Changing the postcode updates the displayed sector. Do not allow an independently conflicting sector.
5. A sector selection without a postcode is only a temporary UI filter. It is not saved on the member. The application may save a member with no postcode, in which case there is no derived sector.

The application should use the returned city and country consistently with the selected postcode. This change does not replace the existing `members.city` and `members.country` fields or automatically overwrite them.

## Backend reads

```sql
-- Sector choices. English labels come directly from the client file.
SELECT DISTINCT sector
FROM public.sectors
ORDER BY sector;

-- Postal-code choices for a sector. Bind the parameter in application code.
SELECT code, postal_code, sector, city, country
FROM public.sectors
WHERE sector = $1
ORDER BY postal_code;

-- Resolve a postal code (bind the postcode string).
SELECT code, postal_code, sector, city, country
FROM public.sectors
WHERE postal_code = $1;

-- Read the saved member's current derived sector.
SELECT member_id, postal_code, sector
FROM public.members_current
WHERE member_id = $1;
```

On member create/update, save `postal_code` as a string such as `80333`; omit `sector` from the write. The backend reads lookup rows and validates form choices. It does not create sector rows for each member. A separate application role needs SELECT on `public.sectors` and the existing member view.

The new source is for the Munich pilot. An unlisted postcode needs a reviewed lookup extension. The current globally unique postcode key must be reviewed before supporting multiple countries.

## Separate unresolved decisions

The client said one mobile number is sufficient and ORI can be dropped. Natalia reports that these two points are still disputed within the team. Neither is implemented by this change. The optional attendance note remains a confirmed change deferred to the next agreed batch.
