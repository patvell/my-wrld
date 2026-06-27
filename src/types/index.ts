export type FlightStatus = 'scheduled' | 'completed' | 'cancelled';
export type FlightType = 'past' | 'future';
export type PersonaMode = 'plane' | 'home';

export interface Flight {
  id: string;
  created_at: string;
  origin_code: string;
  origin_city: string;
  destination_code: string;
  destination_city: string;
  /** Local wall-clock at the origin airport, "YYYY-MM-DDTHH:mm". */
  departure_time: string;
  /** Local wall-clock at the destination airport, "YYYY-MM-DDTHH:mm". */
  arrival_time: string;
  flight_number: string | null;
  status: FlightStatus;
  type: FlightType;
  confirmed_at?: string | null;
  user_id?: string | null;
}

/** Payload accepted when creating or updating a flight. */
export interface FlightInput {
  origin_code: string;
  origin_city: string;
  destination_code: string;
  destination_city: string;
  departure_time: string;
  arrival_time: string;
  flight_number?: string | null;
  status?: FlightStatus;
  type?: FlightType;
  confirmed_at?: string | null;
  user_id?: string | null;
}

export interface AppState {
  id: string;
  updated_at: string;
  partner_city_code: string;
  partner_city_name: string;
  last_persona: PersonaMode;
}

export interface Airport {
  code: string;
  city: string;
  country: string;
}
