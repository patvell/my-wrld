import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Dynamically build the update query based on provided fields
    const keys = Object.keys(body);
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const setClause = keys.map(k => `${k} = @${k}`).join(', ');
    const update = db.prepare(`UPDATE flights SET ${setClause} WHERE id = @id`);

    update.run({ ...body, id });

    // Return the updated flight
    const updatedFlight = db.prepare('SELECT * FROM flights WHERE id = ?').get(id);
    if (!updatedFlight) {
      return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
    }

    return NextResponse.json(updatedFlight);
  } catch (error) {
    console.error('Error updating flight:', error);
    return NextResponse.json({ error: 'Failed to update flight' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleteFlight = db.prepare('DELETE FROM flights WHERE id = ?');
    const result = deleteFlight.run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting flight:', error);
    return NextResponse.json({ error: 'Failed to delete flight' }, { status: 500 });
  }
}
