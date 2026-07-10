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
  {
    name: 'Kongo Central',
    cities: [
      {
        name: 'Matadi',
        communes: [
          'Matadi',
          'Mvuzi',
          'Nzanza',
        ],
      },
      {
        name: 'Bangu',
        communes: [
          'Kimpese',
          'Lukala',
          'Vampa',
        ],
      },
      {
        name: 'Boma',
        communes: [
          'Kabondo',
          'Kalamu',
          'Nzadi',
        ],
      },
      {
        name: 'Inkisi',
        communes: [
          'Kintanu',
          'Kisantu',
        ],
      },
      {
        name: 'Kasangulu',
        communes: [
          'La Gare',
          'Kasangulu',
        ],
      },
      {
        name: 'Lukula',
        communes: [
          'Lukula',
          'Nsioni',
        ],
      },
      {
        name: 'Mbanza-Ngungu',
        communes: [
          'Ngungu',
          'Nioki',
        ],
      },
      {
        name: 'Muanda',
        communes: [
          'Mamputu',
          'Muanda',
        ],
      },
      {
        name: 'Tshela',
        communes: [
          'Kasa-Vubu',
          'Luvu',
          'Tshela',
        ],
      },
      {
        name: 'Territoire de Kasangulu',
        communes: [
          'Kasangulu',
          'Luila',
          'Lukunga Mputu',
        ],
      },
      {
        name: 'Territoire de Kimvula',
        communes: [
          'Kimvula',
          'Benga',
          'Lubusi',
          'Lula-Lumeme',
        ],
      },
      {
        name: 'Territoire de Lukula',
        communes: [
          'Lemba',
          'Fubu',
          'Kakongo',
          'Patu',
          'Tsanga-Sud',
          'Tsundi-Sud',
        ],
      },
      {
        name: 'Territoire de Luozi',
        communes: [
          'Luozi',
          'Sele',
          'Balari',
          'Kenge',
          'Kimbanza',
          'Kimumba',
          'Kinkenge',
          'Kivunda',
          'Mbanza Mona',
          'Mbanza Mwembe',
          'Mbanza Ngoyo',
          'Mongo Luala',
        ],
      },
      {
        name: 'Territoire de Madimba',
        communes: [
          'Madimba',
          'Mfidi Malele',
          'Mfuma Kibambi',
          'Ngeba',
          'Ngufu',
          'Wungu',
        ],
      },
      {
        name: 'Territoire de Mbanza Ngungu',
        communes: [
          'Kwilu-Ngongo',
          'Boko',
          'Gombe Matadi',
          'Gombe Sud',
          'Kivulu',
          'Kwilu Ngongo',
        ],
      },
      {
        name: 'Territoire de Moanda',
        communes: [
          'Assolongo',
          'Boma-Bungu',
          'La Mer',
        ],
      },
      {
        name: 'Territoire de Seke Banza',
        communes: [
          'Kinzau-Mvuete',
          'Seke-Banza',
          'Bundi',
          'Isangila',
          'Lufu',
          'Mbavu',
          'Sumbi',
        ],
      },
      {
        name: 'Territoire de Songololo',
        communes: [
          'Songololo',
          'Bamboma',
          'Kimpese',
          'Luima',
          'Palabala',
          'Wombo',
        ],
      },
      {
        name: 'Territoire de Tshela',
        communes: [
          'Bula Naku',
          'Loango',
          'Lubolo',
          'Lubuzi',
          'Maduda',
          'Nganda Tsundi',
          'Nzobe Luzi',
          'Tshela Mbanga',
        ],
      },
    ],
  },
  {
    name: 'Kwango',
    cities: [
      {
        name: 'Kenge',
        communes: [
          '5 Mai',
          'L.d Kabila',
          'Manonga',
          'Masikita',
          'Mavula',
        ],
      },
      {
        name: 'Kahemba',
        communes: [
          'Kwilu',
          'Lutshima',
          'Ntshakal',
        ],
      },
      {
        name: 'Kasongo-Lunda',
        communes: [
          'Imona',
          'Kituadi',
          'Kumbila',
        ],
      },
      {
        name: 'Territoire de Feshi',
        communes: [
          'Feshi',
          'Ganaketi',
          'Lobo',
          'Maziamo',
          'Mukoso',
        ],
      },
      {
        name: 'Territoire de Kahemba',
        communes: [
          'Bangu',
          'Bindu',
          'Kulindji',
        ],
      },
      {
        name: 'Territoire de Kasongolunda',
        communes: [
          'Pelende',
          'Kibunda',
          'Kingulu',
          'Kizamba',
          'Mawanga',
          'Panzi',
          'Swatenda',
          'Kasa',
          'Kasongo Lunda',
        ],
      },
      {
        name: 'Territoire de Kenge',
        communes: [
          'Kenge Ii',
          'Misele',
          'Pont Kwango',
          'Bukanga Lonzo',
          'Dinga',
          'Kolokoso',
          'Mosambo',
        ],
      },
      {
        name: 'Territoire de Popokabaka',
        communes: [
          'Popokabaka',
          'Kabama',
          'Kisoma',
          'Lufunia',
          'Yonso',
        ],
      },
    ],
  },
  {
    name: 'Kwilu',
    cities: [
      {
        name: 'Bandundu',
        communes: [
          'Basoko',
          'Disasi',
          'Mayoyo',
        ],
      },
      {
        name: 'Bulungu',
        communes: [
          'Buiombe Lusanga',
          'Djuma',
          'Kabangu',
          'Kwilu',
          'Lukonzi',
        ],
      },
      {
        name: 'Dibaya-Lubwe',
        communes: [
          'Ipala',
          'Ndambu',
          'Tshenza',
        ],
      },
      {
        name: 'Idiofa',
        communes: [
          'Idiofa',
          'Manding',
          'Mosanga',
        ],
      },
      {
        name: 'Gungu',
        communes: [
          'Congo',
          'Kakobola',
          'Kwilu',
          'Lukwila',
        ],
      },
      {
        name: 'Kikwit',
        communes: [
          'Kazamba',
          'Lukemi',
          'Lukolela',
          'Nzinda',
        ],
      },
      {
        name: 'Mangai',
        communes: [
          'Menki',
          'Isabo',
        ],
      },
      {
        name: 'Masi-Manimba',
        communes: [
          'Bibembo',
          'Kangamiese',
          'Lukuala',
        ],
      },
      {
        name: 'Territoire de Bagata',
        communes: [
          'Bagata',
          'Misay',
          'Kidzweme',
          'Kwango Kasai',
          'Kwilu Ntober',
          'Manzansay',
          'Wamba Fatundu',
        ],
      },
      {
        name: 'Territoire de Bulungu',
        communes: [
          'Mukedi',
          'Due',
          'Kilunda',
          'Kimbongo',
          'Kipuka',
          'Kwilu Kimbata',
          'Kwenge',
          'Luniungu',
          'Miadi Nkara',
          'Mikwi',
          'Nko Basuku',
        ],
      },
      {
        name: 'Territoire de Idiofa',
        communes: [
          'Eolo',
          'Kalo',
          'Piopio',
          'Banga',
          'Belo',
          'Bulweme',
          'Kalanganda',
          'Kanga',
          'Kapia',
          'Kipuku',
          'Madimbi',
          'Mateko',
          'Musanga',
          'Sedzo',
          'Yassa Lokwa',
        ],
      },
      {
        name: 'Territoire de Gungu',
        communes: [
          'Gungu',
          'Kandale',
          'Kilamba',
          'Kilembe',
          'Kisunzu',
          'Kobo',
          'Kondo',
          'Lozo',
          'Lukamba',
          'Mudikalunga',
          'Mungindu',
          'Ngudi',
        ],
      },
      {
        name: 'Territoire de Masimanimba',
        communes: [
          'Bwalavula',
          'Masamvunga',
          'Pay Kongila',
          'Bindungi',
          'Kibolo',
          'Kinzenga',
          'Kinzenzengo',
          'Kitoy',
          'Masi Manimba',
          'Mokamo',
          'Mosango',
          'Sungu',
        ],
      },
    ],
  },
  {
    name: 'Maï-Ndombe',
    cities: [
      {
        name: 'Inongo',
        communes: [
          'Bonse',
          'Mpolo',
          'Mpongonzoli',
        ],
      },
      {
        name: 'Bolobo',
        communes: [
          'Bolobo',
          'Moseno',
          'Ngo-Bolobo',
        ],
      },
      {
        name: 'Nioki',
        communes: [
          'Nioki',
          'Monga-Nkolo',
        ],
      },
      {
        name: 'Territoire de Bolobo',
        communes: [
          'Bolobo',
        ],
      },
      {
        name: 'Territoire de Inongo',
        communes: [
          'Ntand\'Embelo',
          'Basengele',
          'Bolia',
          'Inongo',
        ],
      },
      {
        name: 'Territoire de Kiri',
        communes: [
          'Kiri',
          'Beronge',
          'Lutoy',
          'Pendjwa',
        ],
      },
      {
        name: 'Territoire de Kutu',
        communes: [
          'Kutu',
          'Bokoro',
          'Ikongo',
          'Semendwa',
          'Semondane',
          'Tolo',
          'Kemba',
          'Lwabu',
          'Mfimi',
        ],
      },
      {
        name: 'Territoire de Kwamouth',
        communes: [
          'Kwamouth',
          'Bateke Nord',
        ],
      },
      {
        name: 'Territoire de Mushie',
        communes: [
          'Mushie',
          'Baboma Nord',
        ],
      },
      {
        name: 'Territoire de Oshwe',
        communes: [
          'Oshwe',
          'Mbien',
          'Lokolama',
          'Lukenie',
          'Kangara',
          'Nkaw',
        ],
      },
      {
        name: 'Territoire de Yumbi',
        communes: [
          'Yumbi',
          'Mongama',
        ],
      },
    ],
  },
  {
    name: 'Équateur',
    cities: [
      {
        name: 'Mbandaka',
        communes: [
          'Mbandaka',
          'Wangata',
        ],
      },
      {
        name: 'Basankusu',
        communes: [
          'Baenga',
          'Basankusu',
        ],
      },
      {
        name: 'Territoire de Basankusu',
        communes: [
          'Bokakata',
          'Basankusu',
          'Gombelo',
          'Waka-Bokeka',
        ],
      },
      {
        name: 'Territoire de Bikoro',
        communes: [
          'Bikoro',
          'Ekonda',
          'Elanga',
          'Lac Ntumba',
        ],
      },
      {
        name: 'Territoire de Bolomba',
        communes: [
          'Bolomba',
          'Busira',
          'Dianga',
          'Losanganya',
          'Mampoko',
        ],
      },
      {
        name: 'Territoire de Bomongo',
        communes: [
          'Bomongo',
          'Djamba',
          'Ngiri',
        ],
      },
      {
        name: 'Territoire de Ingende',
        communes: [
          'Ingende',
          'Bokatola',
          'Duali',
          'Eungu',
        ],
      },
      {
        name: 'Territoire de Makanza',
        communes: [
          'Bangala',
          'Mweko',
          'Ndobo',
        ],
      },
      {
        name: 'Territoire de Lukelela',
        communes: [
          'Lukelela',
          'Banunu-Bobangi',
          'Lusakani',
          'Mpama',
        ],
      },
    ],
  },
  {
    name: 'Mongala',
    cities: [
      {
        name: 'Lisala',
        communes: [
          'Bolikango',
          'Mongala',
        ],
      },
      {
        name: 'Bumba',
        communes: [
          'Budja',
          'Ebonda',
          'Lokole',
          'Molua',
          'Monama',
        ],
      },
      {
        name: 'Territoire de Bongandanga',
        communes: [
          'Bondanganda',
          'Bongandanga',
          'Busu Djanoa',
          'Busu Melo',
          'Busu Simba',
        ],
      },
      {
        name: 'Territoire de Bumba',
        communes: [
          'Banda Yowa',
          'Itimbiri',
          'Loeka',
          'Molua',
          'Monzamboli',
          'Yandongi',
        ],
      },
      {
        name: 'Territoire de Lisala',
        communes: [
          'Binga',
          'Mondongo',
          'Mongala Motima',
          'Ngombe Doko',
          'Ngombe Mombangi',
        ],
      },
    ],
  },
  {
    name: 'Nord-Ubangi',
    cities: [
      {
        name: 'Gbadolite',
        communes: [
          'Gbadolite',
          'Molegbe',
          'Nganza',
        ],
      },
      {
        name: 'Mobayi Mbongo',
        communes: [
          'Mwange',
          'Ngugbi',
        ],
      },
      {
        name: 'Territoire de Businga',
        communes: [
          'Businga',
          'Bodangabo',
          'Karawa',
        ],
      },
      {
        name: 'Territoire de Bosobolo',
        communes: [
          'Bosolobo',
          'Banda',
          'Bili',
          'Bosobolo',
        ],
      },
      {
        name: 'Territoire de Mobayi Mbongo',
        communes: [
          'Otto Banza',
          'Karawa',
          'Mobayi Mbongo',
        ],
      },
      {
        name: 'Territoire de Yakoma',
        communes: [
          'Yakoma',
          'Abumombanzi',
          'Wapinda',
        ],
      },
    ],
  },
  {
    name: 'Sud-Ubangi',
    cities: [
      {
        name: 'Gemena',
        communes: [
          'Gbazulu',
          'Labo',
          'Mongila',
          'Lac Ntumba',
        ],
      },
      {
        name: 'Zongo',
        communes: [
          'Nzulu',
          'Wango',
        ],
      },
      {
        name: 'Territoire de Budjala',
        communes: [
          'Budjala',
          'Banza',
          'Bolingo',
          'Mongala',
          'Ndolo Liboko',
          'Ngombe Doko',
        ],
      },
      {
        name: 'Territoire de Gemena',
        communes: [
          'Banga Kungu',
          'Bowasse',
          'Mbari',
          'Nguya',
        ],
      },
      {
        name: 'Territoire de Kungu',
        communes: [
          'Kungu',
          'Bomboma',
          'Dongo',
          'Lua',
          'Mwanda',
          'Songo',
        ],
      },
      {
        name: 'Territoire de Libenge',
        communes: [
          'Libenge',
          'Libenge Centre',
          'Libenge Nord',
          'Libenge Sud',
        ],
      },
    ],
  },
  {
    name: 'Tshuapa',
    cities: [
      {
        name: 'Boende',
        communes: [
          'Boende',
          'Tshuapa',
        ],
      },
      {
        name: 'Territoire de Befale',
        communes: [
          'Befale',
          'Befumbo',
          'Duale',
          'Lomako',
        ],
      },
      {
        name: 'Territoire de Boende',
        communes: [
          'Bolua',
          'Djera',
          'Lofoy',
          'Wini',
        ],
      },
      {
        name: 'Territoire de Bokungu',
        communes: [
          'Bokungu',
          'Lolaka',
          'Luando',
          'Loombo',
          'Luay',
          'Nkole',
        ],
      },
      {
        name: 'Territoire de Djolu',
        communes: [
          'Djolu',
          'Lingomo',
          'Luo',
          'Yala',
        ],
      },
      {
        name: 'Territoire de Ikela',
        communes: [
          'Ikela',
          'Lofome',
          'Loile',
          'Lokima',
          'Tshuapa',
          'Tumbenga',
        ],
      },
      {
        name: 'Territoire de Monkoto',
        communes: [
          'Monkoto',
          'Bianga',
          'Nongo',
        ],
      },
    ],
  },
  {
    name: 'Bas-Uele',
    cities: [
      {
        name: 'De Buta',
        communes: [
          'Babade',
          'Dobea',
          'Firant',
          'Tepatondele',
        ],
      },
      {
        name: 'Aketi',
        communes: [
          'Itimbiri',
          'Ngbongade',
          'Tinda',
        ],
      },
      {
        name: 'Bondo',
        communes: [
          'Bondo',
          'Uele',
          'Zagili',
        ],
      },
      {
        name: 'Dingila',
        communes: [
          'Bambili',
          'Dingila',
          'Tobola',
        ],
      },
      {
        name: 'Territoire de Aketi',
        communes: [
          'Likati',
          'Kolongwandi',
          'Mabinza',
          'Ngbongi',
          'Yoko',
          'Avaru-Duma',
          'Avaru-Gatanga',
          'Bondongola',
          'Mobati-Boyele',
        ],
      },
      {
        name: 'Territoire de Ango',
        communes: [
          'Ango',
          'Dakwa',
          'Ezo',
          'Mopoy',
          'Ngindo',
          'Sasa',
        ],
      },
      {
        name: 'Territoire de Bambesa',
        communes: [
          'Bambesa',
          'Zobia',
          'Bakete',
          'Bokapo',
          'Bokiba',
          'Bolungwa',
          'Bondongwale',
          'Makere I',
          'Makere Ii',
          'Makere-Bakete',
          'Mange',
        ],
      },
      {
        name: 'Territoire de Bondo',
        communes: [
          'Baye',
          'Bili',
          'Monga',
          'Ndu',
          'Biamange',
          'Boso',
          'Deni',
          'Duaru',
          'Gama',
          'Gaya',
          'Goa',
          'Kasa',
          'Mobenge Mondila',
          'Soa',
        ],
      },
      {
        name: 'Territoire de Buta',
        communes: [
          'Titule',
          'Basiri-Mongingita',
          'Mobati',
          'Bayeu-Bogagia',
          'Bayeu-Bogbama',
          'Monganulu',
          'Nguru',
        ],
      },
      {
        name: 'Territoire de Poko',
        communes: [
          'Poko',
          'Abarambo',
          'Bakangaie-Avuru',
          'Gamu',
          'Babena',
          'Kembisa',
          'Kipate',
          'Mabanga',
          'Madi',
          'Malele',
          'Mendeni',
          'Ngbaradi',
          'Soronga',
          'Zune',
        ],
      },
    ],
  },
  {
    name: 'Haut-Uele',
    cities: [
      {
        name: 'Isiro',
        communes: [
          'Kupa',
          'Mambaya',
          'Mendambo',
        ],
      },
      {
        name: 'Aba',
        communes: [
          'Laskuri',
          'Sambala',
          'Zungbi',
        ],
      },
      {
        name: 'Dungu',
        communes: [
          'Bomokadi',
          'Dungu-Uye',
          'Ngilima',
        ],
      },
      {
        name: 'Wamba',
        communes: [
          'Anaolite',
          'Nepoko',
          'Wamba',
        ],
      },
      {
        name: 'Watsa',
        communes: [
          'Gandza',
          'Kibali',
          'Mangoro',
          'Mongali',
        ],
      },
      {
        name: 'Territoire de Dungu',
        communes: [
          'Doruma',
          'Ndedu',
          'Malingindu',
          'Wando',
        ],
      },
      {
        name: 'Territoire de Faradje',
        communes: [
          'Faradje',
          'Makoko',
          'Dongo',
          'Kakwa-Ladama',
          'Logo-Bagela',
          'Logo-Doka',
          'Logo-Lolia',
          'Logo-Obelela',
          'Logo-Ogambi',
          'Mondo',
        ],
      },
      {
        name: 'Territoire de Niangara',
        communes: [
          'Niangara',
          'Boeme',
          'Kerebobe',
          'Kopa',
          'Mangbele',
          'Mangbetu-Nabisangi',
          'Manzinga',
          'Okondo',
        ],
      },
      {
        name: 'Territoire de Rungu',
        communes: [
          'Rungu',
          'D\'Azanga',
          'Mayongo-Mabozo',
          'Mayongo-Magbale',
          'Mboli',
          'Medje-Mango',
          'Mongomasi',
          'Ndey',
        ],
      },
      {
        name: 'Territoire de Wamba',
        communes: [
          'Ibambi',
          'Mabudu-Malika-Babeyru',
          'Bafwagada',
          'Bafwankoy',
          'Balika-Tiriko',
          'Mahaa',
          'Makoda',
          'Malika',
          'Mangbele',
          'Timoniko',
          'Wadimbisa-Mabudu',
          'Walamba',
        ],
      },
      {
        name: 'Territoire de Watsa',
        communes: [
          'Gombari',
          'Kibali',
          'Mangbutu',
          'Mari Minza',
          'Andikopa-Karikalendu',
          'Andobi',
          'Ateru-Karokalendu',
          'Kebo',
          'Mangbetu',
          'Wasele-D\'Arumbi',
        ],
      },
    ],
  },
  {
    name: 'Ituri',
    cities: [
      {
        name: 'Bunia',
        communes: [
          'Mbunya',
          'Nyakasanza',
          'Shari',
        ],
      },
      {
        name: 'Ariwara',
        communes: [
          'Abbe Gonzalalves',
          'Apaa',
          'Djaudjau',
          'Raoul\'Aliti',
        ],
      },
      {
        name: 'Aru',
        communes: [
          'Abaa',
          'Autsai',
          'Essefe',
          'Pele',
        ],
      },
      {
        name: 'Ingbokolo',
        communes: [
          'Adi',
          'Arie',
          'Kumuru-Ezorili',
        ],
      },
      {
        name: 'Mahagi',
        communes: [
          'Kwong\'A',
          'Mamba',
          'Ridha',
        ],
      },
      {
        name: 'Mongwalo',
        communes: [
          'Mongbalu',
          'Musaba',
          'Plito-Yalala',
        ],
      },
      {
        name: 'Territoire de Aru',
        communes: [
          'Des Ndo Kebo',
          'D\'Alur',
          'Kakwa',
          'Kaliko',
          'Lu',
          'Nio-Mamule',
          'Otso',
          'Zaki',
        ],
      },
      {
        name: 'Territoire de Djugu',
        communes: [
          'Djugu',
          'Fataki',
          'Ndrele',
          'Baniari De Kilo',
          'Walendu Djatsi',
          'Walendu Pitsi',
          'Walendu Tatsi',
          'Babena-Badjere',
          'Bahena Bangyawagi',
          'Bahena-Nord',
          'Mabendi',
          'Mambisa',
          'Ndo-Akebo',
        ],
      },
      {
        name: 'Territoire de Irumu',
        communes: [
          'Irumu',
          'Bahema D\'Irumu',
          'Bahema Itego',
          'Bahema Sud',
          'Walendu Vonkutu',
          'Andisoma',
          'Babelebe',
          'Baboa-Bokode',
          'Bahema-Boga',
          'Baniari-Tchabi',
          'Basiri-Basumu',
          'Mobala',
          'Walendu-Bindi',
        ],
      },
      {
        name: 'Territoire de Mahagi',
        communes: [
          'Djegu Kpadruma',
          'Nioki',
          'Tadu',
          'War Palara',
          'Anghal',
          'Alur Djuganda',
          'Djukoth',
          'Mokambo',
          'Pandoro',
          'Walendu-Watsi',
          'Wangongo',
        ],
      },
      {
        name: 'Territoire de Mambasa',
        communes: [
          'Biakato',
          'Mambasa',
          'Niania',
          'Babombi',
          'Bakwanza',
          'Bandaka',
          'Bambo',
          'Walese-Dese',
          'Walese-Karo',
        ],
      },
    ],
  },
  {
    name: 'Tshopo',
    cities: [
      {
        name: 'Kisangani',
        communes: [
          'Kabondo',
          'Kisangani',
          'Lubunga',
          'Makiso',
          'Mangobo',
          'Tshopo',
        ],
      },
      {
        name: 'Basoko',
        communes: [
          'Bandole',
          'Bandu-Lokutu',
          'Lokumete',
          'Nzombo',
        ],
      },
      {
        name: 'Isangi',
        communes: [
          'Logami',
          'Loolo',
          'Isangi',
          'Fleuve',
        ],
      },
      {
        name: 'Territoire de Bafwasende',
        communes: [
          'Bafwasende',
          'Openge',
          'Bafwandaka',
          'Bakumu D\'Angundu',
          'Bakundumu',
          'Barumbi Opienge',
          'Bekeni Kondolole',
          'Bemili',
        ],
      },
      {
        name: 'Territoire de Banalia',
        communes: [
          'Banalia',
          'Panga',
          'Babwa De Kole',
          'Bamanga',
          'Banalia Bangba',
          'Popoyi',
        ],
      },
      {
        name: 'Territoire de Basoko',
        communes: [
          'Moenge',
          'Bangelema',
          'Bomenge',
          'Lokutu',
          'Mobango Itimbiri',
          'Turumbu',
          'Wahanga',
          'Yaliswa',
          'Yamandundu',
        ],
      },
      {
        name: 'Territoire de Isangi',
        communes: [
          'Bambelota',
          'Lokombe',
          'Luete',
          'Turumbu',
          'Yalikandja Yanonge',
          'Yaokandja',
          'Yawembe Basoa',
          'Baluolambila',
          'Bolomboki',
          'Kombe',
          'Liutua',
          'Yalihala',
          'Yalikoka-Mboso',
        ],
      },
      {
        name: 'Territoire de Opala',
        communes: [
          'Wanie-Rukula',
          'Yaleko',
          'Yatolema',
          'Opala',
          'Iye',
          'Lobaie',
          'Tooli',
          'Yawende Loolo',
          'Kembe',
          'Mongo',
          'Yapandu',
          'Yayango',
          'Yolingo',
          'Yomale',
        ],
      },
      {
        name: 'Territoire de Ubundu',
        communes: [
          'Ubundu',
          'Wanie-Rukula',
          'Bakumu D\'Obiatuku',
          'Bakumu Kilinga',
          'Bakumu Mandombe',
          'Bakumu Mangongo',
          'Basikate',
          'Mituku Bamoya',
          'Walengola Babira',
          'Walengola Baleka',
          'Walengola Lilo',
          'Walengola Lowa',
          'Kirungu',
        ],
      },
      {
        name: 'Territoire de Yahuma',
        communes: [
          'Mosite',
          'Yahuma',
          'Bosoku',
          'Buma',
        ],
      },
    ],
  },
  {
    name: 'Nord-Kivu',
    cities: [
      {
        name: 'Goma',
        communes: [
          'Goma',
          'Karisimbi',
        ],
      },
      {
        name: 'Beni',
        communes: [
          'Beu',
          'Bungulu',
          'Mulekera',
          'Ruwenzori',
        ],
      },
      {
        name: 'Butembo',
        communes: [
          'Bulengera',
          'Kimeni',
          'Mususa',
          'Vulamba',
        ],
      },
      {
        name: 'Luholu',
        communes: [
          'Kayna',
          'Kirumba',
          'Luofu',
          'Mighobwe',
        ],
      },
      {
        name: 'Oicha',
        communes: [
          'Asefu',
          'Mamundiona',
          'Mbimbi',
        ],
      },
      {
        name: 'Rutshuru',
        communes: [
          'Buzito',
          'Katemba',
          'Kiringa',
          'Mabungo',
        ],
      },
      {
        name: 'Territoire de Beni (oicha)',
        communes: [
          'Bulongo',
          'Kasindi',
          'Kyondo',
          'Mangina',
          'Bashu',
          'Beni Mbau',
          'Ruwenzori',
          'Watangila',
        ],
      },
      {
        name: 'Territoire de Lubero',
        communes: [
          'Kanyabayonga',
          'Kasenghe',
          'Kipese',
          'Kirumbu',
          'Kitsombiro',
          'Lubero',
          'Lume',
          'Luotu',
          'Masereka',
          'Ndjiapanda',
          'Bapere',
          'Baswaga',
          'Batangi',
          'Bomate',
        ],
      },
      {
        name: 'Territoire de Masisi',
        communes: [
          'Kilambo',
          'Masisi',
          'Ngungu',
          'Nyamitaba',
          'Sake',
          'Osso Banyungu',
          'Bahunde',
          'Bashali',
        ],
      },
      {
        name: 'Territoire de Nyiragongo',
        communes: [
          'Kibumba',
          'Bukumu',
        ],
      },
      {
        name: 'Territoire de Rutshuru',
        communes: [
          'Bambo',
          'Kibirizi',
          'Nyamilima',
          'Nyanzale',
          'Tshengerero',
          'Bwisha',
          'Bwito',
        ],
      },
      {
        name: 'Territoire de Walikale',
        communes: [
          'Hombo Nord',
          'Mubi',
          'Ndjingala',
          'Pinga',
          'Pinga Bushimoo',
          'Rubaya',
          'Walikale',
          'Bakano',
          'Wanyanga',
        ],
      },
    ],
  },
  {
    name: 'Sud-Kivu',
    cities: [
      {
        name: 'Bukavu',
        communes: [
          'Bagira',
          'Ibanda',
          'Kadutu',
        ],
      },
      {
        name: 'Baraka',
        communes: [
          'Baraka Centre',
          'Kalundja',
          'Katanga',
        ],
      },
      {
        name: 'Kamilunga',
        communes: [
          'Bitanga',
          'Mobale',
        ],
      },
      {
        name: 'Shabunda',
        communes: [
          'Kizikibi',
          'Lupinga',
          'Ngalubua',
        ],
      },
      {
        name: 'Uvira',
        communes: [
          'Kalundu',
          'Kavinvira',
          'Mubongue',
        ],
      },
      {
        name: 'Territoire de Fizi',
        communes: [
          'Fizi',
          'Kavinvira',
          'Lilimba Misisi',
          'Minembue',
          'Lulenge',
          'Mutambala',
          'Ngandja',
          'Tanganika',
        ],
      },
      {
        name: 'Territoire de Idjwi',
        communes: [
          'Rubenga',
          'Ntambuka',
        ],
      },
      {
        name: 'Territoire de Kalehe',
        communes: [
          'Bahavu',
          'Kavunu',
          'Minova',
          'Nyabibwe',
          'Uloho',
        ],
      },
      {
        name: 'Territoire de Kabare',
        communes: [
          'Kabare',
          'Nindja',
        ],
      },
      {
        name: 'Territoire de Mwenga',
        communes: [
          'Itombwe',
          'Barhinyi',
          'Basile',
          'Luhwindja',
          'Lwindi',
        ],
      },
      {
        name: 'Territoire de Shabunda',
        communes: [
          'Lulingu',
          'Bakisi',
          'Wakabango I',
        ],
      },
      {
        name: 'Territoire de Uvira',
        communes: [
          'Kamanyola',
          'Kiliba',
          'Luvungi',
          'Sange',
          'Swima',
          'Bafulero',
          'Bavira',
          'Ruzizi',
        ],
      },
      {
        name: 'Territoire de Walungu',
        communes: [
          'Nyangezi',
          'Kaziba',
          'Ngweshe',
        ],
      },
    ],
  },
  {
    name: 'Maniema',
    cities: [
      {
        name: 'Kindu',
        communes: [
          'Alunguli',
          'Kasuku',
          'Mikelenge',
        ],
      },
      {
        name: 'Kalima',
        communes: [
          'Kamisuku',
          'Luzelukulu',
        ],
      },
      {
        name: 'Kasongo',
        communes: [
          'Kasongo',
          'Musukuyi',
          'Tongoni',
          'Zamba',
        ],
      },
      {
        name: 'Lubutu',
        communes: [
          'Aluza',
          'Lubilinga',
        ],
      },
      {
        name: 'Nanoya',
        communes: [
          'Kama',
          'Byenge',
          'Longwe',
        ],
      },
      {
        name: 'Punia',
        communes: [
          'Obea',
          'Amanyombo',
          'Basenge',
        ],
      },
      {
        name: 'Territoire de Kabambare',
        communes: [
          'Kabambare',
          'Wanaza',
          'Babuyu',
          'Bahemba',
          'Bahombo (bangu Bangu)',
          'Lulindi',
          'Salamabila',
          'Wamaza',
        ],
      },
      {
        name: 'Territoire de Kailo',
        communes: [
          'Kailo',
          'Lubelenge',
          'Ambwe',
          'Wasongola',
          'Balanga',
          'Bangengele',
        ],
      },
      {
        name: 'Territoire de Kasongo',
        communes: [
          'Kipaka',
          'Samba',
          'Likenge',
          'Basonge Ii',
          'Mamba Kasenga',
          'Wazimba Wa Maringa',
          'Wazimba Wa Mulu',
          'Bakwangi',
          'Basonge I',
          'Benye Samba',
          'Nonda',
          'Wagenia',
          'Wazula',
        ],
      },
      {
        name: 'Territoire de Kibombo',
        communes: [
          'Kibondo',
          'Likeri',
          'Kibombo',
          'Aluba',
          'Ankutshu',
          'Bahina',
          'Bakongola',
          'Matapa',
        ],
      },
      {
        name: 'Territoire de Lubutu',
        communes: [
          'Lukachi',
          'Mungele',
          'Tshamaka',
          'Bitule',
          'Obokote',
        ],
      },
      {
        name: 'Territoire de Pangi',
        communes: [
          'Pangi',
          'Kama',
          'Kampene',
          'Babene',
          'Beia',
          'Ikama',
          'Wakabango Ii',
        ],
      },
      {
        name: 'Territoire de Punia',
        communes: [
          'Kibeleketa',
          'Kowe',
          'Babira Bakwame',
          'Baleka',
          'Ulindi',
        ],
      },
    ],
  },
  {
    name: 'Tanganyika',
    cities: [
      {
        name: 'Kalemie',
        communes: [
          'Kalemie',
          'Lukuga',
          'Lac',
        ],
      },
      {
        name: 'Kaoze',
        communes: [
          'Kirungu',
          'Moba Port',
          'Murumbi',
        ],
      },
      {
        name: 'Kongolo',
        communes: [
          'Kabinda',
          'Kangoyi',
          'Lualaba',
        ],
      },
      {
        name: 'Manono',
        communes: [
          'Kanteba',
          'Kitotolo',
          'Laulu-Minono',
          'Lukushi',
        ],
      },
      {
        name: 'Territoire de Kabalo',
        communes: [
          'Kabalo',
          'Lukuswa',
          'Muela Luvunguye',
        ],
      },
      {
        name: 'Territoire de Kalemie',
        communes: [
          'Kalemie',
          'Benze',
          'Rutuku',
          'Tumbwe',
        ],
      },
      {
        name: 'Territoire de Kongolo',
        communes: [
          'Baluba',
          'Basonge',
          'Bayatshi',
          'Bena Mambwe',
          'Bena Muhona',
          'Bena Mwembo',
          'Bena Nkuvu',
          'Lubunda',
          'Munono',
          'Yambula',
        ],
      },
      {
        name: 'Territoire de Manono',
        communes: [
          'Kamalondo',
          'Kyofwe',
          'Luvua',
          'Nyemba',
          'Bakongolo',
          'Kiluba',
        ],
      },
      {
        name: 'Territoire de Moba',
        communes: [
          'Bena Kamanya',
          'Bena Ntanga',
          'Kansabala',
          'Kayabala',
          'Manda',
          'Nganie',
        ],
      },
      {
        name: 'Territoire de Nyunzu',
        communes: [
          'Nyunzu',
          'Nord Lukunga',
          'Sud Lukunga',
        ],
      },
    ],
  },
  {
    name: 'Haut-Lomami',
    cities: [
      {
        name: 'Kamina',
        communes: [
          'Dimayi',
          'Kamina',
          'Sobongo',
        ],
      },
      {
        name: 'Territoire de Bukama',
        communes: [
          'Bukama',
          'Luenga',
          'Kapamayi',
          'Lualaba',
          'Butumba',
          'Kabondo Dianda',
          'Kibanda',
          'Kikondja',
        ],
      },
      {
        name: 'Territoire de Kabongo',
        communes: [
          'Kabongo',
          'Nord Baluba',
          'Kayamba',
        ],
      },
      {
        name: 'Territoire de Kamina',
        communes: [
          'Kinda',
          'Kasongo-Nyembo',
        ],
      },
      {
        name: 'Territoire de Kaniama Kasese',
        communes: [
          'Kaniama',
          'Mutombo-Mukulu',
        ],
      },
      {
        name: 'Territoire de Malembe Nkulu',
        communes: [
          'Malembe',
          'Badia',
          'Ngilima',
          'Dungu Uye',
          'Kayumba',
          'Mulongo',
          'Museka',
          'Mwanza',
          'Nkulu',
        ],
      },
    ],
  },
  {
    name: 'Lualaba',
    cities: [
      {
        name: 'Kolwezi',
        communes: [
          'Dilala',
          'Manika',
        ],
      },
      {
        name: 'Kasaji',
        communes: [
          'Lueu',
          'Lukoji',
          'Tsimbundi',
        ],
      },
      {
        name: 'Territoire de Dilolo',
        communes: [
          'Dilolo',
          'Kisenge',
          'Luena',
          'Lulua Lukoshi',
          'Mutanda',
          'Muyeye',
          'Mwa-Kandal',
          'Mwatshisenge',
          'Ndumba',
          'Saluseke',
          'Tshisangama',
        ],
      },
      {
        name: 'Territoire de Kapanga',
        communes: [
          'Kapanga',
          'Mwant Yav',
        ],
      },
      {
        name: 'Territoire de Lubudi',
        communes: [
          'Lubudi',
        ],
      },
      {
        name: 'Territoire de Mutshatsha',
        communes: [
          'Mutshatsha',
          'Lufupa',
          'Luilu',
          'Mukuleshi',
        ],
      },
      {
        name: 'Territoire de Sandoa',
        communes: [
          'Sandoa',
          'Kayembe-Mukulu',
          'Lumanga',
          'Mbako',
          'Muteba',
          'Sakundunku',
          'Samutona',
          'Tshibamba',
          'Tshipao',
        ],
      },
    ],
  },
  {
    name: 'Haut-Katanga',
    cities: [
      {
        name: 'Lubumbashi',
        communes: [
          'Annexe',
          'Kamalondo',
          'Kampemba',
          'Katuba',
          'Kenya',
          'Lubumbashi',
          'Rwashi',
        ],
      },
      {
        name: 'Kipushi',
        communes: [
          'Katapula',
          'Kipushi',
        ],
      },
      {
        name: 'Likasi',
        communes: [
          'Kikula',
          'Likasi',
          'Panda',
          'Shituru',
        ],
      },
      {
        name: 'Territoire de Kambove',
        communes: [
          'Kambove',
          'Lufira',
          'Source Du Fleuve Congo',
          'Basanga',
        ],
      },
      {
        name: 'Territoire de Kasenga',
        communes: [
          'Kasenga',
          'Bakunda',
          'Kafira',
          'Kisamamba',
          'Luapula',
        ],
      },
      {
        name: 'Territoire de Kipushi',
        communes: [
          'Bukanda',
          'Kaponda',
          'Kinyama',
        ],
      },
      {
        name: 'Territoire de Mitwaba',
        communes: [
          'Mitwaba',
          'Balomotwa',
          'Banweshi',
          'Kyona-Ngoy',
        ],
      },
      {
        name: 'Territoire de Pweto',
        communes: [
          'Kilwa',
          'Pweto',
          'Moero',
          'Mwenga',
          'Kyona-Nzini',
        ],
      },
      {
        name: 'Territoire de Sakania',
        communes: [
          'Kilwa',
          'Mokambo',
          'Musoshi-Kasumbalesa',
          'Sakania',
          'Balala',
          'Balamba',
          'Baushi',
        ],
      },
    ],
  },
  {
    name: 'Kasaï',
    cities: [
      {
        name: 'Tshikapa',
        communes: [
          'Dibumba I',
          'Dibumba Ii',
          'Kanzala',
          'Mabondo',
          'Mbumba',
        ],
      },
      {
        name: 'Ilebo',
        communes: [
          'Bembe',
          'Kasai',
          'Lutshwadi',
          'Puntsha',
        ],
      },
      {
        name: 'Luebo',
        communes: [
          'Bipatu',
          'Kasenga',
          'Luebo',
        ],
      },
      {
        name: 'Tshimbulu',
        communes: [
          'Lukula',
          'Tshimakaka',
          'Tshimayi',
        ],
      },
      {
        name: 'Territoire de Dekese',
        communes: [
          'Dekese',
          'Dekese-Ikolombe Isolu',
          'Yaelima',
        ],
      },
      {
        name: 'Territoire de Ilebo',
        communes: [
          'Mapangu',
          'Mibilayi',
          'Basongo',
          'Sud Banga',
          'Malu Malu',
        ],
      },
      {
        name: 'Territoire de Kamonia',
        communes: [
          'Kamako',
          'Kamonia',
          'Kamwesha',
          'Ngombe',
          'Samwanda',
          'Bakwa-Nyambi',
          'Bampende',
          'Kasadisadi',
          'Kasai-Kabambaie',
          'Kasai-Longatshimo',
          'Kasai-Lunyeka',
          'Lovua-Longatshimo',
          'Lovua-Lushiku',
          'Tshikapa',
        ],
      },
      {
        name: 'Territoire de Luebo',
        communes: [
          'Kalwebo',
          'Luebo Kabambaie',
          'Luebo Lulungele',
          'Luebo Wedi',
          'Ndjoko Punda',
        ],
      },
      {
        name: 'Territoire de Mweka',
        communes: [
          'Mweka',
          'Kakenge',
          'Bakuba',
        ],
      },
    ],
  },
  {
    name: 'Kasaï Central',
    cities: [
      {
        name: 'Kananga',
        communes: [
          'Kananga',
          'Katoka',
          'Lukonga',
          'Ndesha',
          'Nganza',
        ],
      },
      {
        name: 'Territoire de Demba',
        communes: [
          'Demba',
          'Bena Leka',
          'Bena Mamba',
          'Diofwa',
          'Lombele',
          'Lusonge',
          'Mwanza Ngoma',
          'Tshibote',
          'Tshibungu',
        ],
      },
      {
        name: 'Territoire de Dibaya',
        communes: [
          'Dibaya',
          'Tshikula',
          'Dibanda',
          'Dibatayi',
          'Kamwandu',
          'Kasangi',
          'Tshisilu',
        ],
      },
      {
        name: 'Territoire de Dimbelenge',
        communes: [
          'Bana Ba Ntumba',
          'Dimbelenge',
          'Katende',
          'Lubwishi',
          'Masuika',
          'Munkamba',
          'Kunduyi',
          'Lubi',
          'Lubudi',
          'Lukibu',
          'Mashala',
        ],
      },
      {
        name: 'Territoire de Kazumba',
        communes: [
          'Kasumba',
          'Luemba',
          'Bulungu',
          'Kafuba',
          'Kavula',
          'Matamba',
          'Mboie',
          'Miao',
          'Muswaswa',
          'Mutefu',
          'Tshitadi',
        ],
      },
      {
        name: 'Territoire de Luiza',
        communes: [
          'Luiza',
          'Tulume',
          'Yangala',
          'Bambaye',
          'Kabelekese',
          'Kalunga',
          'Loatshi',
          'Lueta',
          'Lusanza',
          'Mbushimaie',
        ],
      },
    ],
  },
  {
    name: 'Kasaï Oriental',
    cities: [
      {
        name: 'Mbuji-Mayi',
        communes: [
          'Bipemba',
          'Dibindi',
          'Diulu',
          'Kanshi',
          'Muya',
        ],
      },
      {
        name: 'Lukalaba',
        communes: [
          'Katoto',
          'Monzo',
          'Nsangu',
        ],
      },
      {
        name: 'Miabi',
        communes: [
          'Lukunza',
          'Nyanyiki',
          'Miabi',
        ],
      },
      {
        name: 'Tshilenge',
        communes: [
          'Inga',
          'Kimpatshi',
          'Tshikalenga',
        ],
      },
      {
        name: 'Territoire de Kabeya Kamwanga',
        communes: [
          'Bena Nkuna',
          'Lac Mukamba',
          'Kalela',
          'Mpemba',
          'Ndomba',
        ],
      },
      {
        name: 'Territoire de Katanda',
        communes: [
          'Katanda',
          'Baluba-Lubilanji',
          'Bena Tshitolo',
          'Mutuayi',
          'Nsangu',
        ],
      },
      {
        name: 'Territoire de Lupatapata',
        communes: [
          'Tshishimbi',
          'Kabala',
          'Mudiba',
          'Mukumbi',
          'Mulenda',
        ],
      },
      {
        name: 'Territoire de Miabi',
        communes: [
          'Boya',
          'Katende',
          'Kangayi',
          'Movo-Nkatshi',
          'Tshijiba',
          'Tshilundu',
        ],
      },
      {
        name: 'Territoire de Tshilenge',
        communes: [
          'Kalenda Kashila',
          'Kabimba',
          'Kalonji Sud',
          'Kampatshi',
          'Lalelu',
          'Lukalaba',
          'Tshipuka',
        ],
      },
    ],
  },
  {
    name: 'Lomami',
    cities: [
      {
        name: 'Kabinda',
        communes: [
          'Kabongo',
          'Kabwela-Bwela',
          'Kajiba',
          'Mudingayi',
        ],
      },
      {
        name: 'Lubao',
        communes: [
          'Kangoyi',
          'Lomami',
          'Lumumba',
          'Kisampa',
        ],
      },
      {
        name: 'Mbuy-A-Show',
        communes: [
          'Lukombo',
          'Mukukuyi',
          'Mumvuyi',
          'Tshibiayi',
        ],
      },
      {
        name: 'Mwene-Ditu',
        communes: [
          'Bondoyi',
          'Musadi',
          'Mwene-Ditu',
        ],
      },
      {
        name: 'Ngandajika',
        communes: [
          'Kabanda',
          'Kalumbanda Tshoji',
          'Kalunda Musoko',
          'Lunda',
        ],
      },
      {
        name: 'Territoire de Kabinda',
        communes: [
          'Kakula',
          'Kamende',
          'Mpendje',
          'Munyengwe',
          'Baluba Lubangule',
          'Kabinda',
          'Ludimbi Lukula',
          'Lufubu Lomami',
          'Lukashie Lualu',
          'Vunayi',
        ],
      },
      {
        name: 'Territoire de Kamiji',
        communes: [
          'Kamiji Tshisangu',
          'Malenge',
          'Kamiji',
          'Luekeshi',
        ],
      },
      {
        name: 'Territoire de Lubao',
        communes: [
          'Balunga',
          'Ebondo Kape',
          'Kamana',
          'Mwamwayi',
          'Bekalebwe',
          'Kisengwa',
          'Lubao',
          'Tshofa',
        ],
      },
      {
        name: 'Territoire de Muene Ditu',
        communes: [
          'Kasekeyi',
          'Lusuku',
          'Tshabut',
          'Wikong',
          'Kanda Kanda',
          'Kanitshina',
          'Katshisungu',
          'Mulundu',
        ],
      },
      {
        name: 'Territoire de Ngandajika',
        communes: [
          'Kalunda Musoko',
          'Baluba Shankadi',
          'Ngandajika',
          'Tshiyamba',
          'Bakwa Mulumba',
          'Bena Kalambayi',
        ],
      },
    ],
  },
  {
    name: 'Sankuru',
    cities: [
      {
        name: 'Lusambo',
        communes: [
          'Kabondo',
          'Lumpema',
          'Lusambo',
          'Tusuanganyi',
        ],
      },
      {
        name: 'Bena-Dibela',
        communes: [
          'Bene-Dibele',
          'Lowele',
        ],
      },
      {
        name: 'Lodja',
        communes: [
          'Lokenya',
          'Londa',
          'Lumumba',
          'Nganga',
          'Shapembe',
          'Esenge',
          'Okitandeke',
        ],
      },
      {
        name: 'Lumumbaville (wembo-Nyama)',
        communes: [
          'Wembo-Nyama',
          'Ewango',
        ],
      },
      {
        name: 'Tshumbe',
        communes: [
          'Okitongombe',
          'Otete',
        ],
      },
      {
        name: 'Territoire de Katako Kombe',
        communes: [
          'Katakokombe',
          'Kutshiakoyi',
          'Basambala',
          'Djalo',
          'Lonya',
          'Lukumbe',
          'Ngandu',
          'Ukulungu',
          'Watambulu Nord',
          'Watambulu Sud',
          'Batetela-Arabises',
        ],
      },
      {
        name: 'Territoire de Kole',
        communes: [
          'Kole',
          'Ankutshu',
          'Batetela Dibele',
          'Bankutshu Lukenie',
          'Ohindo',
          'Basho',
          'Ankutshu Dibele',
        ],
      },
      {
        name: 'Territoire de Lodja',
        communes: [
          'Kotshayi',
          'Olemba',
          'Hamba Mange',
          'Kondo Tshumbe',
          'Lufungu',
          'Lutshimba',
          'Nambelu (luhembe)',
          'Vunge',
          'Watambulu',
        ],
      },
      {
        name: 'Territoire de Lomela',
        communes: [
          'Lomela Olua',
          'Batetela Lomela',
          'Bakela',
          'Bahamba I',
          'Bahamba Ii',
          'Okutu',
        ],
      },
      {
        name: 'Territoire de Lubefu',
        communes: [
          'Lubefu',
          'Panya Mutombo',
          'Basonge',
          'Mondja Ngandu',
          'Ndjovu',
          'Ngandu Wuma',
        ],
      },
      {
        name: 'Territoire de Lusambo',
        communes: [
          'Basonge',
          'Batetela',
          'Kashindi',
          'Lubi',
          'Mpanyamutombo',
          'Sankuru',
          'Entree Kunduye Malaba',
          'Entree Lubi Kunduye',
        ],
      },
    ],
  },
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
