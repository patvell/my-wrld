import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const flights = db.prepare('SELECT * FROM flights ORDER BY departure_time ASC').all();
    return NextResponse.json(flights);
  } catch (error) {
    console.error('Error fetching flights:', error);
    return NextResponse.json({ error: 'Failed to fetch flights' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Generate a random ID if not provided (UUID format)
    const id = body.id || crypto.randomUUID();
    
    const insert = db.prepare(`
      INSERT INTO flights (
        id, origin_code, origin_city, destination_code, destination_city,
        departure_time, arrival_time, flight_number, status, type, confirmed_at, user_id
      ) VALUES (
        @id, @origin_code, @origin_city, @destination_code, @destination_city,
        @departure_time, @arrival_time, @flight_number, @status, @type, @confirmed_at, @user_id
      )
    `);

    const newFlight = {
      ...body,
      id,
      confirmed_at: body.confirmed_at || null,
      user_id: body.user_id || null,
      status: body.status || null,
      type: body.type || null,
      flight_number: body.flight_number || null,
    };

    insert.run(newFlight);
    
    // Return the created flight
    const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(id);
    return NextResponse.json(flight, { status: 201 });
  } catch (error) {
    console.error('Error creating flight:', error);
    return NextResponse.json({ error: 'Failed to create flight' }, { status: 500 });
  }
}
