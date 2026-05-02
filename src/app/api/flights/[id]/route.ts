import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDb();
    const { id } = await params;
    const body = await request.json();

    const keys = Object.keys(body);
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const setClause = keys.map((k, i) => `${k} = ?`).join(', ');
    const values = [...keys.map(k => body[k]), id];

    await db.execute({
      sql: `UPDATE flights SET ${setClause} WHERE id = ?`,
      args: values,
    });

    const updatedFlight = await db.execute({ sql: 'SELECT * FROM flights WHERE id = ?', args: [id] });
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
    const { id } = await params;

    const result = await db.execute({ sql: 'DELETE FROM flights WHERE id = ?', args: [id] });

    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting flight:', error);
    return NextResponse.json({ error: 'Failed to delete flight' }, { status: 500 });
  }
}
