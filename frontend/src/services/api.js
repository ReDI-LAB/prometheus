/**
 * API Service for Project Prometheus
 * Connects frontend forms to FastAPI backend endpoints.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/**
 * Custom error class capturing HTTP status and backend detail
 */
export class ApiError extends Error {
  constructor(message, status, detail = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Helper to extract error message details from FastAPI response body
 */
async function extractErrorMessage(response) {
  try {
    const errorData = await response.json();
    if (typeof errorData.detail === "string") {
      return errorData.detail;
    }
    if (Array.isArray(errorData.detail)) {
      // Pydantic validation errors (array of field issues)
      return errorData.detail
        .map((err) => `${err.loc.join(".")}: ${err.msg}`)
        .join(", ");
    }
    if (errorData.detail) {
      return JSON.stringify(errorData.detail);
    }
    return JSON.stringify(errorData);
  } catch {
    return response.statusText || "Unbekannter Serverfehler";
  }
}

/**
 * Helper to handle HTTP errors, parsing FastAPI JSON responses {"detail": "..."}
 */
async function handleResponse(response) {
  if (response.ok) {
    return response.json();
  }

  const errorDetail = await extractErrorMessage(response);

  switch (response.status) {
    case 422:
      throw new ApiError(
        `Ungültige Eingabedaten (422): ${errorDetail}`,
        422,
        errorDetail,
      );
    case 503:
      throw new ApiError(
        "Datenbank ist derzeit nicht erreichbar (503). Bitte später erneut versuchen.",
        503,
        errorDetail,
      );
    default:
      throw new ApiError(
        `Serverfehler (${response.status}): ${errorDetail}`,
        response.status,
        errorDetail,
      );
  }
}

/**
 * Submit daily attendance entry (BAB)
 *
 * @param {Object} payload
 * @param {string} payload.member_id - UUID of the member
 * @param {string} payload.attendance_date - Date in format YYYY-MM-DD
 * @param {string} payload.time_in - Arrival time in format HH:MM
 * @param {string} [payload.time_out] - Departure time in format HH:MM (optional)
 * @returns {Promise<Object>} Created attendance record
 */
export async function createAttendance({
  member_id,
  attendance_date,
  time_in,
  time_out,
}) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/attendance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        member_id,
        attendance_date,
        time_in,
        time_out: time_out || null,
      }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      "Keine Verbindung zum Backend möglich. Bitte prüfen, ob FastAPI auf Port 8000 läuft.",
      0,
      error.message,
    );
  }
}

/**
 * Submit phone log call entry
 *
 * @param {Object} payload
 * @param {string} payload.person_id - UUID of the member or staff
 * @param {'member'|'staff'} payload.person_type - Type of caller
 * @param {string} payload.call_date - Date in format YYYY-MM-DD
 * @param {number} payload.duration_minutes - Positive integer
 * @param {number} payload.topic_code - Topic code integer (1-5)
 * @param {string} [payload.note] - Optional freeform note
 * @returns {Promise<Object>} Created phone call record
 */
export async function createPhoneCall({
  person_id,
  person_type,
  call_date,
  duration_minutes,
  topic_code,
  note,
}) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/phone-calls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        person_id,
        person_type,
        call_date,
        duration_minutes: Number(duration_minutes),
        topic_code: Number(topic_code),
        note: note ? note.trim() : null,
      }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      "Keine Verbindung zum Backend möglich. Bitte prüfen, ob FastAPI auf Port 8000 läuft.",
      0,
      error.message,
    );
  }
}
