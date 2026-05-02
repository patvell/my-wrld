import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.execute('SELECT * FROM flights ORDER BY departure_time ASC');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching flights:', error);
    return NextResponse.json({ error: 'Failed to fetch flights' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const id = body.id || crypto.randomUUID();

    await db.execute({
      sql: `INSERT INTO flights (
        id, origin_code, origin_city, destination_code, destination_city,
        departure_time, arrival_time, flight_number, status, type, confirmed_at, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.origin_code,
        body.origin_city,
        body.destination_code,
        body.destination_city,
        body.departure_time,
        body.arrival_time,
        body.flight_number || null,
        body.status || null,
        body.type || null,
        body.confirmed_at || null,
        body.user_id || null,
      ],
    });

    // Return the created flight
    const flight = await db.execute({ sql: 'SELECT * FROM flights WHERE id = ?', args: [id] });
    return NextResponse.json(flight.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating flight:', error);
    return NextResponse.json({ error: 'Failed to create flight' }, { status: 500 });
  }
}
