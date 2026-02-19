export type FlightStatus = 'scheduled' | 'in-air' | 'landed' | 'cancelled';
export type FlightType = 'past' | 'future';
export type PersonaMode = 'plane' | 'home';

export interface Flight {
  id: string;
  created_at: string;
  origin_code: string;
  origin_city: string;
  destination_code: string;
  destination_city: string;
  departure_time: string;
  arrival_time: string;
  flight_number: string;
  status: FlightStatus;
  type: FlightType;
  confirmed_at?: string;
  user_id?: string;
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
