export interface RDCLocationProvince {
  name: string;
  cities: {
    name: string;
    communes: string[];
  }[];
}

export const rdcLocations: RDCLocationProvince[] = [
  {
    name: 'Kinshasa',
    cities: [
      {
        name: 'Kinshasa',
        communes: [
          'Bandalungwa',
          'Barumbu',
          'Bumbu',
          'Gombe',
          'Kalamu',
          'Kasa-Vubu',
          'Kimbanseke',
          'Kinshasa',
          'Kintambo',
          'Kisenso',
          'Lemba',
          'Limete',
          'Lingwala',
          'Makala',
          'Maluku',
          'Masina',
          'Matete',
          'Mont-Ngafula',
          'Ndjili',
          'Ngaba',
          'Ngaliema',
          'Ngiri-Ngiri',
          'Nsele',
          'Selembao',
        ],
      },
    ],
  },
  { name: 'Kongo Central', cities: [] },
  { name: 'Kwango', cities: [] },
  { name: 'Kwilu', cities: [] },
  { name: 'Maï-Ndombe', cities: [] },
  { name: 'Équateur', cities: [] },
  { name: 'Mongala', cities: [] },
  { name: 'Nord-Ubangi', cities: [] },
  { name: 'Sud-Ubangi', cities: [] },
  { name: 'Tshuapa', cities: [] },
  { name: 'Bas-Uele', cities: [] },
  { name: 'Haut-Uele', cities: [] },
  { name: 'Ituri', cities: [] },
  { name: 'Tshopo', cities: [] },
  { name: 'Nord-Kivu', cities: [] },
  { name: 'Sud-Kivu', cities: [] },
  { name: 'Maniema', cities: [] },
  { name: 'Tanganyika', cities: [] },
  { name: 'Haut-Lomami', cities: [] },
  { name: 'Lualaba', cities: [] },
  { name: 'Haut-Katanga', cities: [] },
  { name: 'Kasaï', cities: [] },
  { name: 'Kasaï Central', cities: [] },
  { name: 'Kasaï Oriental', cities: [] },
  { name: 'Lomami', cities: [] },
  { name: 'Sankuru', cities: [] },
];

export function getProvinceNames(): string[] {
  return rdcLocations.map((province) => province.name);
}

export function getCitiesByProvince(provinceName: string): string[] {
  const province = rdcLocations.find((p) => p.name === provinceName);
  return province?.cities.map((city) => city.name) || [];
}

export function getCommunesByCity(
  provinceName: string,
  cityName: string,
): string[] {
  const province = rdcLocations.find((p) => p.name === provinceName);
  const city = province?.cities.find((c) => c.name === cityName);
  return city?.communes || [];
}
