# Prometheus Redi V4 — review and changes

Decisions confirmed by Natalia on 25 November 2026. The client confirmed two separate phone fields. Landline and ORI interviewer are optional. Keep the Munich-only postcode restriction. ORI remains in the form.

| Review item | V3 status | V4 status and remaining application work |
| --- | --- | --- |
| Mobile and landline | One `members.phone` field | Retain `phone` for Mobile in the new form and add nullable `landline_phone`. Keep existing values unchanged. The backend maps both form inputs to separate columns. |
| ORI Closing Interview Conducted By | No storage field | Add nullable `members.ori_interviewer_id` referencing `staff.staff_id`. The backend reads staff choices and saves the selected UUID or NULL. No interview date/result fields are added. |
| Attendance Note | No storage field | Add nullable `attendance.note`. Save text for the selected visit, copy it to `attendance_deleted.note` on deletion and clear live/archived notes during controlled member redaction. |
| Sector | 74 seeded postcodes and `members_current.sector` | Retained. The backend should return the derived sector with the member and include the lookup rows in its lookup endpoint. SQL does not create the endpoint. |
| Non-Munich postcodes | Rejected unless NULL | Keep this restriction, explicitly confirmed by Natalia. Do not add an invented postcode or assign a Munich sector to an outside address. Store NULL when no supported postcode is supplied. This pilot cannot retain an unlisted postcode in `members.postal_code`. |
| Postcode uniqueness across countries | Postcode alone is unique | Retained for the Munich pilot. No new international support is claimed. Before expanding geographically, redesign the key as country + postcode and review associated member references; do not silently reuse V4 for that expansion. |
| Gender and Title lookups | Present in SQL; no dedicated Excel tabs | Values now appear on `genders` and `salutations` tabs. Title maps to `members.salutation`. Both fields remain optional. |
| Other lookup dictionaries | Present in SQL, mostly omitted from Excel | All 15 seeded lookup dictionaries are now documented in Excel. This includes 10 country entries. Three old status dictionaries are explicitly labelled legacy; the Boolean status fields do not use them. |
| Health check | Valid file was omitted from the small handover | Include the nonempty `prometheus_redi_healthcheck_V4.sql` in this delivery. |
| Existing V3 installation | Fresh installer cannot upgrade it | Supply `prometheus_redi_upgrade_V3_to_V4.sql`. It adds optional columns and updates the affected view, guards and redaction procedure while preserving existing rows and values. |

## Backend field mapping

| UI input | Write target | May be omitted? |
| --- | --- | --- |
| Mobile | `members.phone` | SQL continues to allow NULL; the form's required-field rule is an application decision. |
| Landline / Phone | `members.landline_phone` | Yes, send NULL. |
| ORI interviewer | `members.ori_interviewer_id` | Yes, send NULL. It references an existing staff UUID, not a person's name. |
| Attendance Note | `attendance.note` | Yes, send NULL. |
| Member sector | No independent write | Read `members_current.sector`; it follows the selected postcode. |

The existing `phone` column is retained to avoid breaking existing backend writes or moving old values into a different column. Existing phone contents are not evidence that a number is mobile; review legacy records when needed. The newly agreed form uses `phone` for Mobile and `landline_phone` for Landline.

## Delivery limits and remaining work

The schema changes do not implement API routes or UI bindings. The backend/frontend team still needs to connect the two phone inputs, optional ORI selection, attendance notes, sector output and lookup responses. The database accepts these values and checks applicable references.

Call duration remains a positive integer number of minutes. Seconds or start/end call timestamps require a separate agreed change. Partition maintenance still needs an assigned owner and scheduler. Those tasks are not completed by this release.

Financial tables remain available for future use. The pre-existing opening-balance redesign is not resolved by these UI remarks: `cash_opening_balances` still exists. It must not be reported as removed. Existing deposit/purchase sign rules, operation clubhouse snapshots, Boolean statuses and automatic deletion archives are retained.

Technical pseudonymisation still retains UUID relationships. V4 extends the existing clearing rules to the new member fields and attendance notes; it does not introduce a legal guarantee of anonymity or an automatic retention job.
