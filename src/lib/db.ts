import { createClient } from '@libsql/client';

let client: ReturnType<typeof createClient> | null = null;
let initialized = false;

export async function getDb() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      // If we're building, we might not have these yet. 
      // Return a dummy or throw a more helpful error if called at runtime.
      if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
         throw new Error("Missing Turso environment variables.");
      }
      // Return a proxy or just fail gracefully if this is just a build-time import
      console.warn("Turso environment variables not found. Database will be unavailable.");
      return null as any; 
    }

    client = createClient({ url, authToken });
  }

  const db = client;

  if (!initialized && db) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS flights (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT (datetime('now')),
        origin_code TEXT NOT NULL,
        origin_city TEXT NOT NULL,
        destination_code TEXT NOT NULL,
        destination_city TEXT NOT NULL,
        departure_time TEXT NOT NULL,
        arrival_time TEXT NOT NULL,
        flight_number TEXT,
        status TEXT,
        type TEXT,
        confirmed_at TEXT,
        user_id TEXT
      )
    `);

    // Seed data only if table is empty
    const count = await db.execute('SELECT COUNT(*) as c FROM flights');
    if (Number(count.rows[0].c) === 0) {
      const seedData = [
        { id: "305b865c-c5d5-4e00-8afb-eedaa6490387", created_at: "2026-02-19T22:50:44.100194+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "BLR", destination_city: "Bengaluru", departure_time: "2026-01-30T03:40:00+00:00", arrival_time: "2026-01-30T08:50:00+00:00", status: "completed", type: "past", flight_number: "EK564", confirmed_at: null, user_id: null },
        { id: "0ebf1552-a239-47f4-9938-2642b47861e8", created_at: "2026-02-19T22:52:45.277756+00:00", origin_code: "BLR", origin_city: "Bengaluru", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-01-30T10:25:00+00:00", arrival_time: "2026-01-30T13:00:00+00:00", status: "completed", type: "past", flight_number: "EK127", confirmed_at: null, user_id: null },
        { id: "15e62369-de3f-4278-a154-116d02803646", created_at: "2026-02-19T23:01:34.999331+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "VIE", destination_city: "Vienna", departure_time: "2026-01-31T08:55:00+00:00", arrival_time: "2026-01-31T11:23:00+00:00", status: "completed", type: "past", flight_number: "EK028", confirmed_at: null, user_id: null },
        { id: "6c8f8fde-4035-487b-884c-61ccf022d5cd", created_at: "2026-02-19T23:02:54.594064+00:00", origin_code: "VIE", origin_city: "Vienna", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-02-01T14:55:00+00:00", arrival_time: "2026-02-01T23:25:00+00:00", status: "completed", type: "past", flight_number: "EK128", confirmed_at: null, user_id: null },
        { id: "4122dd3f-da41-483c-a597-c896fecfd7bd", created_at: "2026-02-19T23:05:27.672741+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "CAN", destination_city: "Guangzhou", departure_time: "2026-02-05T10:50:00+00:00", arrival_time: "2026-02-05T20:45:00+00:00", status: "completed", type: "past", flight_number: "EK362", confirmed_at: null, user_id: null },
        { id: "e6fc2cad-f8a2-4b59-8579-a33e8ae7a1de", created_at: "2026-02-19T23:07:58.151346+00:00", origin_code: "CAN", origin_city: "Guangzhou", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-02-07T00:15:00+00:00", arrival_time: "2026-02-07T05:00:00+00:00", status: "completed", type: "past", flight_number: "EK363", confirmed_at: null, user_id: null },
        { id: "faea3b96-73a7-471f-9475-d19de7f1bd26", created_at: "2026-02-19T23:13:51.174781+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "PVG", destination_city: "Shanghai", departure_time: "2026-02-09T09:15:00+00:00", arrival_time: "2026-02-09T21:05:00+00:00", status: "completed", type: "past", flight_number: "EK304", confirmed_at: null, user_id: null },
        { id: "590bb3d2-6571-43dc-9760-8190e168f9b0", created_at: "2026-02-19T23:14:20.497724+00:00", origin_code: "PVG", origin_city: "Shanghai", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-02-11T06:15:00+00:00", arrival_time: "2026-02-11T12:05:00+00:00", status: "completed", type: "past", flight_number: "EK305", confirmed_at: null, user_id: null },
        { id: "88a1e4f7-5873-42de-b42d-e161d48407a7", created_at: "2026-02-19T23:14:56.490682+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "LUN", destination_city: "Lusaka", departure_time: "2026-02-14T09:15:00+00:00", arrival_time: "2026-02-14T14:20:00+00:00", status: "completed", type: "past", flight_number: "EK713", confirmed_at: null, user_id: null },
        { id: "ea3964a8-efb6-49d6-80d0-8ddcb914ab3f", created_at: "2026-02-19T23:15:26.892841+00:00", origin_code: "LUN", origin_city: "Lusaka", destination_code: "HRE", destination_city: "Harare", departure_time: "2026-02-14T15:55:00+00:00", arrival_time: "2026-02-14T17:00:00+00:00", status: "completed", type: "past", flight_number: "EK713", confirmed_at: null, user_id: null },
        { id: "9e61bb03-654e-4934-a570-bd2257789cb7", created_at: "2026-02-19T23:16:13.653969+00:00", origin_code: "HRE", origin_city: "Harare", destination_code: "LUN", destination_city: "Lusaka", departure_time: "2026-02-15T18:45:00+00:00", arrival_time: "2026-02-15T19:50:00+00:00", status: "completed", type: "past", flight_number: "EK714", confirmed_at: null, user_id: null },
        { id: "98f88032-c264-478f-83b6-e3efe40922e6", created_at: "2026-02-19T23:16:55.895646+00:00", origin_code: "LUN", origin_city: "Lusaka", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-02-15T21:20:00+00:00", arrival_time: "2026-02-16T06:25:00+00:00", status: "completed", type: "past", flight_number: "EK714", confirmed_at: null, user_id: null },
        { id: "301c3541-6d3d-48cc-8eab-a11723f91f1d", created_at: "2026-02-19T23:17:55.136475+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "MAA", destination_city: "Chennai", departure_time: "2026-02-19T21:00:00+00:00", arrival_time: "2026-02-20T02:15:00+00:00", status: "completed", type: "past", flight_number: "EK542", confirmed_at: null, user_id: null },
        { id: "660d59ba-dffd-4f25-8337-5d286894dade", created_at: "2026-02-19T23:18:43.018397+00:00", origin_code: "MAA", origin_city: "Chennai", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-02-20T03:50:00+00:00", arrival_time: "2026-02-20T06:35:00+00:00", status: "completed", type: "past", flight_number: "EK543", confirmed_at: null, user_id: null },
        { id: "17a1dfea-845f-47a9-8ea6-6b608b48bd56", created_at: "2026-02-20T14:08:10.274977+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "MNL", destination_city: "Manila", departure_time: "2026-02-23T09:25:00+00:00", arrival_time: "2026-02-23T21:35:00+00:00", status: "completed", type: "past", flight_number: "EK334", confirmed_at: null, user_id: null },
        { id: "0581dc4d-356b-4c79-9eaf-9cac022d8eca", created_at: "2026-02-20T14:16:57.235611+00:00", origin_code: "MNL", origin_city: "Manila", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-02-24T23:30:00+00:00", arrival_time: "2026-02-25T04:45:00+00:00", status: "completed", type: "past", flight_number: "EK335", confirmed_at: null, user_id: null },
        { id: "b0ff3c7a-7290-4f50-9f47-1dfd78030304", created_at: "2026-03-11T13:51:11.853604+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "CPT", destination_city: "Cape Town", departure_time: "2026-03-12T09:10:00+00:00", arrival_time: "2026-03-12T16:45:00+00:00", status: "completed", type: "past", flight_number: "EK770", confirmed_at: null, user_id: null },
        { id: "5effc0ba-96c5-44bb-862c-b337704b0905", created_at: "2026-03-11T13:53:09.501005+00:00", origin_code: "CPT", origin_city: "Cape Town", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-03-13T18:30:00+00:00", arrival_time: "2026-03-14T05:55:00+00:00", status: "completed", type: "past", flight_number: "EK771", confirmed_at: null, user_id: null },
        { id: "ec3bd986-4c79-4fc7-886a-384ed80e4b6c", created_at: "2026-03-24T19:44:05.600065+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "ISB", destination_city: "Islamabad", departure_time: "2026-03-25T21:30:00+00:00", arrival_time: "2026-03-26T01:30:00+00:00", status: "completed", type: "past", flight_number: "EK614", confirmed_at: null, user_id: null },
        { id: "58eca617-3083-4823-9a47-f9956bb02b91", created_at: "2026-03-24T19:44:42.223249+00:00", origin_code: "ISB", origin_city: "Islamabad", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-03-26T03:15:00+00:00", arrival_time: "2026-03-26T05:45:00+00:00", status: "completed", type: "past", flight_number: "EK615", confirmed_at: null, user_id: null },
        { id: "1222d3ef-5ea1-4407-8b2f-582537ac8025", created_at: "2026-04-06T16:40:18.230576+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "YYZ", destination_city: "Toronto", departure_time: "2026-04-07T02:15:00+00:00", arrival_time: "2026-04-07T09:30:00+00:00", status: "completed", type: "past", flight_number: "EK241", confirmed_at: null, user_id: null },
        { id: "58f8add8-3709-4341-9f9c-44518f45f071", created_at: "2026-03-16T17:39:18.617547+00:00", origin_code: "YYZ", origin_city: "Toronto", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-04-08T14:55:00+00:00", arrival_time: "2026-04-09T11:40:00+00:00", status: "completed", type: "past", flight_number: "EK242", confirmed_at: null, user_id: null },
        { id: "bcd9443f-1aea-40a5-aeb1-569ef74dd121", created_at: "2026-04-21T18:32:21.381564+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "LHR", destination_city: "London Heathrow", departure_time: "2026-04-20T14:45:00+00:00", arrival_time: "2026-04-20T20:45:00+00:00", status: "completed", type: "past", flight_number: "EK005", confirmed_at: null, user_id: null },
        { id: "24647955-73a1-40aa-8e9f-60769f51ba5f", created_at: "2026-04-21T18:30:31.631092+00:00", origin_code: "LHR", origin_city: "London Heathrow", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-04-21T22:15:00+00:00", arrival_time: "2026-04-22T09:00:00+00:00", status: "completed", type: "past", flight_number: "EK006", confirmed_at: null, user_id: null },
        { id: "4157f9c2-9419-45d4-a476-d8553f8d8c43", created_at: "2026-04-25T03:44:26.071039+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "DEL", destination_city: "Delhi", departure_time: "2026-04-26T03:55:00+00:00", arrival_time: "2026-04-26T09:05:00+00:00", status: "completed", type: "past", flight_number: "EK510", confirmed_at: null, user_id: null },
        { id: "17deebe2-086e-4448-8ce3-082dd5c7a630", created_at: "2026-04-25T03:44:48.472284+00:00", origin_code: "DEL", origin_city: "Delhi", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-04-26T11:00:00+00:00", arrival_time: "2026-04-26T13:00:00+00:00", status: "completed", type: "past", flight_number: "EK511", confirmed_at: null, user_id: null },
        { id: "8035d068-02a5-4b18-b1be-3a93c57736c4", created_at: "2026-05-02T15:36:50.579113+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "JNB", destination_city: "Johannesburg", departure_time: "2026-05-09T09:55:00+00:00", arrival_time: "2026-05-09T16:15:00+00:00", status: "scheduled", type: "future", flight_number: "EK763", confirmed_at: null, user_id: null },
        { id: "8f933ea0-46e2-4bac-a04d-f6109e4f730a", created_at: "2026-05-02T15:37:18.435326+00:00", origin_code: "JNB", origin_city: "Johannesburg", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-05-10T19:10:00+00:00", arrival_time: "2026-05-11T05:25:00+00:00", status: "scheduled", type: "future", flight_number: "EK784", confirmed_at: null, user_id: null },
        { id: "c30fe974-60e5-4de9-b0e8-b989cf1e1983", created_at: "2026-05-02T15:37:54.166789+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "PEW", destination_city: "Peshawar", departure_time: "2026-05-19T03:20:00+00:00", arrival_time: "2026-05-19T07:30:00+00:00", status: "scheduled", type: "future", flight_number: "EK636", confirmed_at: null, user_id: null },
        { id: "f0deb5a1-d7e3-4191-998f-c422117d541b", created_at: "2026-05-02T15:38:22.078624+00:00", origin_code: "PEW", origin_city: "Peshawar", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-05-19T09:05:00+00:00", arrival_time: "2026-05-19T11:15:00+00:00", status: "scheduled", type: "future", flight_number: "EK637", confirmed_at: null, user_id: null },
        { id: "a8553714-e257-4047-9804-7a1983b8d223", created_at: "2026-05-02T15:38:53.182851+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "MUC", destination_city: "Munich", departure_time: "2026-05-21T08:50:00+00:00", arrival_time: "2026-05-21T13:15:00+00:00", status: "scheduled", type: "future", flight_number: "EK049", confirmed_at: null, user_id: null },
        { id: "6168c744-e51f-41c8-8007-b8ec5feccdde", created_at: "2026-05-02T15:39:18.508895+00:00", origin_code: "MUC", origin_city: "Munich", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-05-22T15:40:00+00:00", arrival_time: "2026-05-22T23:40:00+00:00", status: "scheduled", type: "future", flight_number: "EK050", confirmed_at: null, user_id: null },
        { id: "ce5a68c5-8f5b-4516-8568-b20860a46ba0", created_at: "2026-05-02T15:39:43.429705+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "STN", destination_city: "London Stansted", departure_time: "2026-05-24T08:20:00+00:00", arrival_time: "2026-05-24T12:55:00+00:00", status: "scheduled", type: "future", flight_number: "EK065", confirmed_at: null, user_id: null },
        { id: "7d6a838d-51f9-468b-9a98-bb7513a95c31", created_at: "2026-05-02T15:40:17.986436+00:00", origin_code: "STN", origin_city: "London Stansted", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-05-25T14:55:00+00:00", arrival_time: "2026-05-25T01:00:00+00:00", status: "scheduled", type: "future", flight_number: "EK066", confirmed_at: null, user_id: null },
        { id: "11c27c16-ebc3-4441-baa6-75832e53c005", created_at: "2026-05-02T15:40:46.502993+00:00", origin_code: "DXB", origin_city: "Dubai", destination_code: "BLR", destination_city: "Bengaluru", departure_time: "2026-05-28T13:45:00+00:00", arrival_time: "2026-05-28T19:20:00+00:00", status: "scheduled", type: "future", flight_number: "EK565", confirmed_at: null, user_id: null },
        { id: "e9dd0624-f78b-43fa-8b14-f8afcdfccb07", created_at: "2026-05-02T15:41:14.483207+00:00", origin_code: "BLR", origin_city: "Bengaluru", destination_code: "DXB", destination_city: "Dubai", departure_time: "2026-05-28T21:00:00+00:00", arrival_time: "2026-05-28T23:20:00+00:00", status: "scheduled", type: "future", flight_number: "EK567", confirmed_at: null, user_id: null },
      ];

      for (const f of seedData) {
        await db.execute({
          sql: `INSERT OR IGNORE INTO flights (id, created_at, origin_code, origin_city, destination_code, destination_city, departure_time, arrival_time, status, type, flight_number, confirmed_at, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [f.id, f.created_at, f.origin_code, f.origin_city, f.destination_code, f.destination_city, f.departure_time, f.arrival_time, f.status, f.type, f.flight_number, f.confirmed_at, f.user_id],
        });
      }
    }

    initialized = true;
  }
  return db;
}

export default db;
