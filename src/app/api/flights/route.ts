import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserId } from '@/lib/auth';
import { createFlightSchema } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const userId = getUserId(request);
    const result = await db.execute({
      sql: 'SELECT * FROM flights WHERE user_id = ? ORDER BY departure_time ASC',
      args: [userId],
    });
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching flights:', error);
    return NextResponse.json({ error: 'Failed to fetch flights' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const userId = getUserId(request);
    const body = await request.json();

    const parsed = createFlightSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid flight', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const data = parsed.data;
    const id = crypto.randomUUID();

    await db.execute({
      sql: `INSERT INTO flights (
        id, origin_code, origin_city, destination_code, destination_city,
        departure_time, arrival_time, flight_number, status, type, confirmed_at, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        data.origin_code,
        data.origin_city,
        data.destination_code,
        data.destination_city,
        data.departure_time,
        data.arrival_time,
        data.flight_number ?? null,
        data.status ?? null,
        data.type ?? null,
        data.confirmed_at ?? null,
        userId,
      ],
    });

    const flight = await db.execute({
      sql: 'SELECT * FROM flights WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    return NextResponse.json(flight.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating flight:', error);
    return NextResponse.json({ error: 'Failed to create flight' }, { status: 500 });
  }
}
