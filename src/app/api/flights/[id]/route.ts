import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserId } from '@/lib/auth';
import { updateFlightSchema } from '@/lib/validation';

/** Columns a client is permitted to update (prevents identifier injection). */
const ALLOWED_COLUMNS = new Set([
  'origin_code',
  'origin_city',
  'destination_code',
  'destination_city',
  'departure_time',
  'arrival_time',
  'flight_number',
  'status',
  'type',
  'confirmed_at',
  'fa_flight_id',
]);

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDb();
    const userId = getUserId(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = updateFlightSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const entries = Object.entries(parsed.data).filter(([k]) => ALLOWED_COLUMNS.has(k));
    if (entries.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const existing = await db.execute({
      sql: `SELECT id FROM flights WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = '')`,
      args: [id, userId],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
    }

    const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = [...entries.map(([, v]) => v ?? null), id, userId];

    await db.execute({
      sql: `UPDATE flights SET ${setClause} WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = '')`,
      args: values,
    });

    const updatedFlight = await db.execute({
      sql: `SELECT * FROM flights WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = '')`,
      args: [id, userId],
    });
    if (updatedFlight.rows.length === 0) {
      return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
    }

    return NextResponse.json(updatedFlight.rows[0]);
  } catch (error) {
    console.error('Error updating flight:', error);
    return NextResponse.json({ error: 'Failed to update flight' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDb();
    const userId = getUserId(request);
    const { id } = await params;

    const existing = await db.execute({
      sql: `SELECT id FROM flights WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = '')`,
      args: [id, userId],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
    }

    await db.execute({
      sql: `DELETE FROM flights WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = '')`,
      args: [id, userId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting flight:', error);
    return NextResponse.json({ error: 'Failed to delete flight' }, { status: 500 });
  }
}
