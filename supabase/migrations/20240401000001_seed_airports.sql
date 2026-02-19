-- Emirates Global Directory Seed
CREATE TABLE IF NOT EXISTS airports (
    code TEXT PRIMARY KEY,
    city TEXT NOT NULL,
    country TEXT NOT NULL
);

INSERT INTO airports (code, city, country) VALUES
('DXB', 'DUBAI', 'AE'),
('YUL', 'MONTREAL', 'CA'),
('LHR', 'LONDON', 'GB'),
('JFK', 'NEW YORK', 'US'),
('CDG', 'PARIS', 'FR'),
('SIN', 'SINGAPORE', 'SG'),
('SYD', 'SYDNEY', 'AU'),
('CMB', 'COLOMBO', 'LK'),
('ZNZ', 'ZANZIBAR', 'TZ'),
('MLE', 'MALE', 'MV'),
('HKG', 'HONG KONG', 'HK'),
('NRT', 'TOKYO', 'JP'),
('CPH', 'COPENHAGEN', 'DK'),
('BJS', 'BEIJING', 'CN'),
('BOM', 'MUMBAI', 'IN'),
('CPT', 'CAPE TOWN', 'ZA'),
('GRU', 'SAO PAULO', 'BR'),
('MXP', 'MILAN', 'IT'),
('BCN', 'BARCELONA', 'ES')
ON CONFLICT (code) DO NOTHING;
