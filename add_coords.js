const fs = require('fs');
const https = require('https');

const AIRPORTS_FILE = './src/data/airports.ts';

https.get('https://raw.githubusercontent.com/mwgg/Airports/master/airports.json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const globalAirports = JSON.parse(data);
        const codeToCoords = {};
        for (const key in globalAirports) {
            const ap = globalAirports[key];
            if (ap.iata && ap.iata !== '\\N') {
                codeToCoords[ap.iata] = { lat: ap.lat, lng: ap.lon };
            }
        }

        let content = fs.readFileSync(AIRPORTS_FILE, 'utf8');
        
        if (!content.includes('lat?: number;')) {
            content = content.replace(
                'timezone: string; // IANA timezone string\n}', 
                'timezone: string; // IANA timezone string\n    lat?: number;\n    lng?: number;\n}'
            );
        }
        
        const regex = /([A-Z]{3}):\s*\{([^}]+)\}/g;
        let missing = [];
        
        content = content.replace(regex, (match, code, props) => {
            if (codeToCoords[code]) {
                if (props.includes('lat:')) return match;
                const { lat, lng } = codeToCoords[code];
                // remove trailing space if exists
                let cleanProps = props.trim();
                if (cleanProps.endsWith(',')) cleanProps = cleanProps.slice(0, -1);
                return `${code}: { ${cleanProps}, lat: ${lat}, lng: ${lng} }`;
            } else {
                missing.push(code);
                return match;
            }
        });
        
        fs.writeFileSync(AIRPORTS_FILE, content);
        console.log("Updated airports. Missing coordinates for: ", missing);
    });
}).on('error', (err) => console.log('Error: ' + err.message));
