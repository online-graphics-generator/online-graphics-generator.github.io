'use strict';

const BODY_DATA = [
  {
    id: 'Sun',
    name: 'Sun',
    category: 'Star',
    color: '#ffd36a',
    radius: 1.5,
    astro: 'Sun',
    summary: 'The Sun is the star that anchors the solar system. In this planetarium it defines daylight, twilight, and the apparent path called the ecliptic.',
    facts: [
      ['Mean radius', '696,340 km'],
      ['Light time', '8 min 20 sec'],
      ['Surface', 'Photosphere'],
      ['Observation', 'Never view directly without certified solar filters']
    ]
  },
  {
    id: 'Moon',
    name: 'Moon',
    category: 'Natural satellite',
    color: '#d8d9d2',
    radius: 1.08,
    astro: 'Moon',
    summary: 'The Moon is Earths natural satellite. Its changing phase, altitude, and nodes drive the rhythm of eclipses and many visible night-sky events.',
    facts: [
      ['Mean distance', '384,400 km'],
      ['Orbital period', '27.3 days'],
      ['Phase cycle', '29.5 days'],
      ['Observation', 'Craters and maria are visible in small telescopes']
    ]
  },
  {
    id: 'Mercury',
    name: 'Mercury',
    category: 'Inner planet',
    color: '#b8a58a',
    radius: 0.5,
    astro: 'Mercury',
    summary: 'Mercury is the innermost planet. From Earth it stays close to the Sun, so the best viewing windows happen near greatest elongation.',
    facts: [
      ['Solar orbit', '88 Earth days'],
      ['Mean radius', '2,440 km'],
      ['Atmosphere', 'Trace exosphere'],
      ['Observation', 'Best near dawn or dusk']
    ]
  },
  {
    id: 'Venus',
    name: 'Venus',
    category: 'Inner planet',
    color: '#f1d18a',
    radius: 0.72,
    astro: 'Venus',
    summary: 'Venus is the brightest planet in Earths sky. Its cloud deck reflects sunlight strongly and it shows telescope phases like the Moon.',
    facts: [
      ['Solar orbit', '224.7 Earth days'],
      ['Mean radius', '6,052 km'],
      ['Atmosphere', 'Dense carbon dioxide'],
      ['Observation', 'Often the morning or evening star']
    ]
  },
  {
    id: 'Mars',
    name: 'Mars',
    category: 'Terrestrial planet',
    color: '#df725d',
    radius: 0.62,
    astro: 'Mars',
    summary: 'Mars is the red terrestrial planet beyond Earth. Its apparent brightness changes dramatically as Earth catches it near opposition.',
    facts: [
      ['Solar orbit', '687 Earth days'],
      ['Mean radius', '3,390 km'],
      ['Moons', 'Phobos and Deimos'],
      ['Observation', 'Best around opposition']
    ]
  },
  {
    id: 'Jupiter',
    name: 'Jupiter',
    category: 'Gas giant',
    color: '#e3b27b',
    radius: 1.0,
    astro: 'Jupiter',
    summary: 'Jupiter is the largest planet. It is usually bright to the naked eye, and its four largest moons are visible in modest binoculars or telescopes.',
    facts: [
      ['Solar orbit', '11.86 Earth years'],
      ['Mean radius', '69,911 km'],
      ['Main feature', 'Great Red Spot'],
      ['Observation', 'Cloud bands and Galilean moons']
    ]
  },
  {
    id: 'Saturn',
    name: 'Saturn',
    category: 'Gas giant',
    color: '#ead39b',
    radius: 0.9,
    astro: 'Saturn',
    summary: 'Saturn is the ringed gas giant. The ring tilt seen from Earth changes over time, making its telescopic appearance seasonally distinct.',
    facts: [
      ['Solar orbit', '29.45 Earth years'],
      ['Mean radius', '58,232 km'],
      ['Main feature', 'Broad icy rings'],
      ['Observation', 'Rings visible with a small telescope']
    ]
  },
  {
    id: 'Uranus',
    name: 'Uranus',
    category: 'Ice giant',
    color: '#8ad7d6',
    radius: 0.64,
    astro: 'Uranus',
    summary: 'Uranus is a distant ice giant with a highly tilted rotation axis. Under dark skies it can be near naked-eye visibility but is easier with optics.',
    facts: [
      ['Solar orbit', '84 Earth years'],
      ['Mean radius', '25,362 km'],
      ['Atmosphere', 'Hydrogen, helium, methane'],
      ['Observation', 'Small blue-green disk in telescopes']
    ]
  },
  {
    id: 'Neptune',
    name: 'Neptune',
    category: 'Ice giant',
    color: '#6d8bff',
    radius: 0.6,
    astro: 'Neptune',
    summary: 'Neptune is the outermost major planet. It is too dim for unaided vision and appears as a tiny blue disk through larger amateur telescopes.',
    facts: [
      ['Solar orbit', '164.8 Earth years'],
      ['Mean radius', '24,622 km'],
      ['Largest moon', 'Triton'],
      ['Observation', 'Requires telescope or strong binoculars']
    ]
  }
];

const STAR_CATALOG = [
  { name: 'Sirius', ra: 6.7525, dec: -16.7161, mag: -1.46 },
  { name: 'Canopus', ra: 6.3992, dec: -52.6957, mag: -0.74 },
  { name: 'Arcturus', ra: 14.2610, dec: 19.1825, mag: -0.05 },
  { name: 'Vega', ra: 18.6156, dec: 38.7837, mag: 0.03 },
  { name: 'Capella', ra: 5.2782, dec: 45.9980, mag: 0.08 },
  { name: 'Rigel Kentaurus', ra: 14.6601, dec: -60.8351, mag: -0.27 },
  { name: 'Rigel', ra: 5.2423, dec: -8.2016, mag: 0.13 },
  { name: 'Procyon', ra: 7.6550, dec: 5.2250, mag: 0.34 },
  { name: 'Betelgeuse', ra: 5.9195, dec: 7.4071, mag: 0.42 },
  { name: 'Achernar', ra: 1.6286, dec: -57.2368, mag: 0.46 },
  { name: 'Hadar', ra: 14.0637, dec: -60.3730, mag: 0.61 },
  { name: 'Altair', ra: 19.8464, dec: 8.8683, mag: 0.76 },
  { name: 'Acrux', ra: 12.4433, dec: -63.0991, mag: 0.76 },
  { name: 'Aldebaran', ra: 4.5987, dec: 16.5093, mag: 0.86 },
  { name: 'Spica', ra: 13.4199, dec: -11.1613, mag: 0.97 },
  { name: 'Antares', ra: 16.4901, dec: -26.4320, mag: 1.06 },
  { name: 'Pollux', ra: 7.7553, dec: 28.0262, mag: 1.14 },
  { name: 'Fomalhaut', ra: 22.9608, dec: -29.6222, mag: 1.16 },
  { name: 'Deneb', ra: 20.6905, dec: 45.2803, mag: 1.25 },
  { name: 'Regulus', ra: 10.1395, dec: 11.9672, mag: 1.35 },
  { name: 'Adhara', ra: 6.9771, dec: -28.9721, mag: 1.50 },
  { name: 'Castor', ra: 7.5767, dec: 31.8883, mag: 1.58 },
  { name: 'Gacrux', ra: 12.5194, dec: -57.1132, mag: 1.63 },
  { name: 'Shaula', ra: 17.5601, dec: -37.1038, mag: 1.62 },
  { name: 'Bellatrix', ra: 5.4189, dec: 6.3497, mag: 1.64 },
  { name: 'Elnath', ra: 5.4382, dec: 28.6075, mag: 1.65 },
  { name: 'Miaplacidus', ra: 9.2200, dec: -69.7172, mag: 1.67 },
  { name: 'Alnilam', ra: 5.6036, dec: -1.2019, mag: 1.69 },
  { name: 'Alnair', ra: 22.1372, dec: -46.9606, mag: 1.73 },
  { name: 'Alioth', ra: 12.9005, dec: 55.9598, mag: 1.76 },
  { name: 'Dubhe', ra: 11.0621, dec: 61.7510, mag: 1.79 },
  { name: 'Mirfak', ra: 3.4054, dec: 49.8612, mag: 1.79 },
  { name: 'Wezen', ra: 7.1399, dec: -26.3932, mag: 1.83 },
  { name: 'Kaus Australis', ra: 18.4029, dec: -34.3846, mag: 1.85 },
  { name: 'Alkaid', ra: 13.7923, dec: 49.3133, mag: 1.86 },
  { name: 'Sargas', ra: 17.6219, dec: -42.9980, mag: 1.86 },
  { name: 'Polaris', ra: 2.5303, dec: 89.2641, mag: 1.98 },
  { name: 'Kochab', ra: 14.8451, dec: 74.1555, mag: 2.08 },
  { name: 'Pherkad', ra: 15.3455, dec: 71.8340, mag: 3.05 },
  { name: 'Caph', ra: 0.1529, dec: 59.1498, mag: 2.27 },
  { name: 'Schedar', ra: 0.6751, dec: 56.5373, mag: 2.24 },
  { name: 'Navi', ra: 0.9451, dec: 60.7167, mag: 2.47 },
  { name: 'Ruchbah', ra: 1.4303, dec: 60.2353, mag: 2.68 },
  { name: 'Segin', ra: 1.9066, dec: 63.6701, mag: 3.35 },
  { name: 'Alpheratz', ra: 0.1398, dec: 29.0904, mag: 2.07 },
  { name: 'Mirach', ra: 1.1622, dec: 35.6206, mag: 2.06 },
  { name: 'Almach', ra: 2.0649, dec: 42.3297, mag: 2.10 },
  { name: 'Hamal', ra: 2.1196, dec: 23.4624, mag: 2.01 },
  { name: 'Sheratan', ra: 1.9107, dec: 20.8080, mag: 2.64 },
  { name: 'Menkar', ra: 3.0379, dec: 4.0897, mag: 2.54 },
  { name: 'Diphda', ra: 0.7265, dec: -17.9866, mag: 2.04 },
  { name: 'Algol', ra: 3.1361, dec: 40.9556, mag: 2.12 },
  { name: 'Miram', ra: 3.1511, dec: 49.6135, mag: 3.76 },
  { name: 'Alcyone', ra: 3.7914, dec: 24.1051, mag: 2.87 },
  { name: 'Maia', ra: 3.7638, dec: 24.3678, mag: 3.87 },
  { name: 'Electra', ra: 3.7479, dec: 24.1133, mag: 3.70 },
  { name: 'Merope', ra: 3.7721, dec: 23.9484, mag: 4.18 },
  { name: 'Atlas', ra: 3.8194, dec: 24.0534, mag: 3.63 },
  { name: 'Saiph', ra: 5.7959, dec: -9.6696, mag: 2.07 },
  { name: 'Mintaka', ra: 5.5334, dec: -0.2991, mag: 2.23 },
  { name: 'Alnitak', ra: 5.6793, dec: -1.9426, mag: 1.74 },
  { name: 'Meissa', ra: 5.5856, dec: 9.9342, mag: 3.39 },
  { name: 'Hatsya', ra: 5.5906, dec: -5.9099, mag: 2.75 },
  { name: 'Cursa', ra: 5.1308, dec: -5.0864, mag: 2.79 },
  { name: 'Zaurak', ra: 3.9672, dec: -13.5085, mag: 2.95 },
  { name: 'Acamar', ra: 2.9710, dec: -40.3047, mag: 3.22 },
  { name: 'Mirzam', ra: 6.3783, dec: -17.9559, mag: 1.98 },
  { name: 'Aludra', ra: 7.4016, dec: -29.3031, mag: 2.45 },
  { name: 'Naos', ra: 8.0597, dec: -40.0031, mag: 2.21 },
  { name: 'Avior', ra: 8.3752, dec: -59.5095, mag: 1.86 },
  { name: 'Aspidiske', ra: 9.2848, dec: -59.2752, mag: 2.21 },
  { name: 'Suhail', ra: 9.1333, dec: -43.4326, mag: 2.25 },
  { name: 'Menkent', ra: 14.1114, dec: -36.3700, mag: 2.06 },
  { name: 'Mimosa', ra: 12.7953, dec: -59.6888, mag: 1.25 },
  { name: 'Imai', ra: 12.2524, dec: -58.7489, mag: 2.79 },
  { name: 'Ginan', ra: 12.3560, dec: -60.4011, mag: 3.59 },
  { name: 'Denebola', ra: 11.8177, dec: 14.5721, mag: 2.14 },
  { name: 'Algieba', ra: 10.3328, dec: 19.8415, mag: 2.08 },
  { name: 'Zosma', ra: 11.2351, dec: 20.5237, mag: 2.56 },
  { name: 'Chertan', ra: 11.2373, dec: 15.4296, mag: 3.33 },
  { name: 'Rasalhague', ra: 17.5822, dec: 12.5600, mag: 2.08 },
  { name: 'Sabik', ra: 17.1729, dec: -15.7249, mag: 2.43 },
  { name: 'Cebalrai', ra: 17.7245, dec: 4.5673, mag: 2.76 },
  { name: 'Rasalgethi', ra: 17.2441, dec: 14.3903, mag: 3.48 },
  { name: 'Kornephoros', ra: 16.5037, dec: 21.4896, mag: 2.78 },
  { name: 'Zubenelgenubi', ra: 14.8479, dec: -16.0418, mag: 2.75 },
  { name: 'Zubeneschamali', ra: 15.2834, dec: -9.3831, mag: 2.61 },
  { name: 'Dschubba', ra: 16.0056, dec: -22.6217, mag: 2.29 },
  { name: 'Sadr', ra: 20.3705, dec: 40.2567, mag: 2.23 },
  { name: 'Gienah', ra: 20.7702, dec: 33.9703, mag: 2.48 },
  { name: 'Albireo', ra: 19.5120, dec: 27.9597, mag: 3.05 },
  { name: 'Aljanah', ra: 20.7702, dec: 33.9703, mag: 2.48 },
  { name: 'Sulafat', ra: 18.9824, dec: 32.6896, mag: 3.25 },
  { name: 'Sheliak', ra: 18.8347, dec: 33.3627, mag: 3.52 },
  { name: 'Markab', ra: 23.0793, dec: 15.2053, mag: 2.49 },
  { name: 'Scheat', ra: 23.0629, dec: 28.0828, mag: 2.42 },
  { name: 'Algenib', ra: 0.2206, dec: 15.1836, mag: 2.83 },
  { name: 'Enif', ra: 21.7364, dec: 9.8750, mag: 2.39 },
  { name: 'Matar', ra: 22.7167, dec: 30.2213, mag: 2.95 },
  { name: 'Sadalmelik', ra: 22.0964, dec: -0.3199, mag: 2.95 },
  { name: 'Sadalsuud', ra: 21.5260, dec: -5.5712, mag: 2.87 },
  { name: 'Skat', ra: 22.9108, dec: -15.8208, mag: 3.27 },
  { name: 'Deneb Algedi', ra: 21.7840, dec: -16.1273, mag: 2.85 },
  { name: 'Dabih', ra: 20.3502, dec: -14.7814, mag: 3.05 },
  { name: 'Nunki', ra: 18.9211, dec: -26.2967, mag: 2.05 },
  { name: 'Ascella', ra: 19.0435, dec: -29.8801, mag: 2.60 },
  { name: 'Kaus Media', ra: 18.3499, dec: -29.8281, mag: 2.72 },
  { name: 'Kaus Borealis', ra: 18.4662, dec: -25.4217, mag: 2.82 },
  { name: 'Alnasl', ra: 18.0968, dec: -30.4241, mag: 2.98 },
  { name: 'Rukbat', ra: 19.3981, dec: -40.6162, mag: 3.97 },
  { name: 'Etamin', ra: 17.9434, dec: 51.4889, mag: 2.24 },
  { name: 'Rastaban', ra: 17.5072, dec: 52.3014, mag: 2.79 },
  { name: 'Thuban', ra: 14.0732, dec: 64.3758, mag: 3.67 },
  { name: 'Edasich', ra: 15.4155, dec: 58.9661, mag: 3.29 },
  { name: 'Mizar', ra: 13.3987, dec: 54.9254, mag: 2.23 },
  { name: 'Megrez', ra: 12.2571, dec: 57.0326, mag: 3.31 },
  { name: 'Phecda', ra: 11.8972, dec: 53.6948, mag: 2.43 },
  { name: 'Merak', ra: 11.0307, dec: 56.3824, mag: 2.37 },
  { name: 'Alhena', ra: 6.6285, dec: 16.3993, mag: 1.93 },
  { name: 'Zavijava', ra: 11.8449, dec: 1.7647, mag: 3.59 },
  { name: 'Porrima', ra: 12.6943, dec: -1.4494, mag: 2.74 },
  { name: 'Brachium', ra: 15.0678, dec: -25.2819, mag: 3.25 },
  { name: 'Tarazed', ra: 19.7709, dec: 10.6133, mag: 2.72 },
  { name: 'Alshain', ra: 19.9219, dec: 6.4079, mag: 3.71 },
  { name: 'Nashira', ra: 21.6682, dec: -16.6623, mag: 3.68 },
  { name: 'Sarin', ra: 16.3290, dec: 33.7991, mag: 3.12 },
  { name: 'Mira', ra: 2.3224, dec: -2.9776, mag: 3.04 }
];

const CONSTELLATIONS = [
  { id: 'orion', name: 'Orion', lines: [['Betelgeuse', 'Bellatrix'], ['Betelgeuse', 'Alnitak'], ['Bellatrix', 'Mintaka'], ['Alnitak', 'Mintaka'], ['Alnitak', 'Saiph'], ['Mintaka', 'Rigel'], ['Saiph', 'Rigel'], ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'], ['Alnilam', 'Hatsya']] },
  { id: 'ursa-major', name: 'Ursa Major', lines: [['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid']] },
  { id: 'ursa-minor', name: 'Ursa Minor', lines: [['Polaris', 'Kochab'], ['Kochab', 'Pherkad'], ['Pherkad', 'Polaris']] },
  { id: 'cassiopeia', name: 'Cassiopeia', lines: [['Caph', 'Schedar'], ['Schedar', 'Navi'], ['Navi', 'Ruchbah'], ['Ruchbah', 'Segin']] },
  { id: 'andromeda', name: 'Andromeda', lines: [['Alpheratz', 'Mirach'], ['Mirach', 'Almach']] },
  { id: 'perseus', name: 'Perseus', lines: [['Mirfak', 'Algol'], ['Mirfak', 'Miram'], ['Miram', 'Almach']] },
  { id: 'taurus', name: 'Taurus', lines: [['Aldebaran', 'Elnath'], ['Aldebaran', 'Alcyone'], ['Alcyone', 'Atlas'], ['Atlas', 'Maia'], ['Maia', 'Electra'], ['Electra', 'Merope']] },
  { id: 'gemini', name: 'Gemini', lines: [['Castor', 'Pollux'], ['Pollux', 'Alhena'], ['Castor', 'Alhena']] },
  { id: 'canis-major', name: 'Canis Major', lines: [['Sirius', 'Mirzam'], ['Sirius', 'Wezen'], ['Wezen', 'Adhara'], ['Wezen', 'Aludra']] },
  { id: 'carina', name: 'Carina', lines: [['Canopus', 'Miaplacidus'], ['Miaplacidus', 'Avior'], ['Avior', 'Aspidiske'], ['Canopus', 'Suhail']] },
  { id: 'crux', name: 'Crux', lines: [['Acrux', 'Gacrux'], ['Mimosa', 'Imai'], ['Acrux', 'Mimosa'], ['Gacrux', 'Imai'], ['Imai', 'Ginan']] },
  { id: 'leo', name: 'Leo', lines: [['Regulus', 'Algieba'], ['Algieba', 'Zosma'], ['Zosma', 'Denebola'], ['Denebola', 'Chertan'], ['Chertan', 'Regulus']] },
  { id: 'virgo', name: 'Virgo', lines: [['Spica', 'Zavijava'], ['Spica', 'Porrima']] },
  { id: 'libra', name: 'Libra', lines: [['Zubenelgenubi', 'Zubeneschamali'], ['Zubeneschamali', 'Brachium']] },
  { id: 'scorpius', name: 'Scorpius', lines: [['Dschubba', 'Antares'], ['Antares', 'Sargas'], ['Sargas', 'Shaula']] },
  { id: 'sagittarius', name: 'Sagittarius', lines: [['Kaus Borealis', 'Kaus Media'], ['Kaus Media', 'Kaus Australis'], ['Kaus Australis', 'Alnasl'], ['Kaus Australis', 'Ascella'], ['Ascella', 'Nunki'], ['Nunki', 'Kaus Borealis'], ['Ascella', 'Rukbat']] },
  { id: 'cygnus', name: 'Cygnus', lines: [['Deneb', 'Sadr'], ['Sadr', 'Gienah'], ['Sadr', 'Albireo'], ['Sadr', 'Aljanah']] },
  { id: 'lyra', name: 'Lyra', lines: [['Vega', 'Sheliak'], ['Sheliak', 'Sulafat'], ['Sulafat', 'Vega']] },
  { id: 'aquila', name: 'Aquila', lines: [['Altair', 'Tarazed'], ['Altair', 'Alshain']] },
  { id: 'pegasus', name: 'Pegasus', lines: [['Alpheratz', 'Scheat'], ['Scheat', 'Markab'], ['Markab', 'Algenib'], ['Algenib', 'Alpheratz'], ['Scheat', 'Matar'], ['Markab', 'Enif']] },
  { id: 'aquarius', name: 'Aquarius', lines: [['Sadalmelik', 'Sadalsuud'], ['Sadalsuud', 'Skat'], ['Skat', 'Deneb Algedi']] },
  { id: 'capricornus', name: 'Capricornus', lines: [['Deneb Algedi', 'Dabih'], ['Dabih', 'Nashira']] },
  { id: 'ophiuchus', name: 'Ophiuchus', lines: [['Rasalhague', 'Cebalrai'], ['Rasalhague', 'Sabik'], ['Cebalrai', 'Kornephoros']] },
  { id: 'hercules', name: 'Hercules', lines: [['Rasalgethi', 'Kornephoros'], ['Kornephoros', 'Sarin']] },
  { id: 'draco', name: 'Draco', lines: [['Thuban', 'Edasich'], ['Edasich', 'Etamin'], ['Etamin', 'Rastaban']] },
  { id: 'aries', name: 'Aries', lines: [['Hamal', 'Sheratan']] },
  { id: 'cetus', name: 'Cetus', lines: [['Diphda', 'Menkar'], ['Menkar', 'Mira']] },
  { id: 'eridanus', name: 'Eridanus', lines: [['Cursa', 'Zaurak'], ['Zaurak', 'Acamar'], ['Acamar', 'Achernar']] }
];

const DOME_RADIUS = 78;
const BODY_RADIUS = 62;
const $ = (selector) => document.querySelector(selector);

const dom = {
  canvas: $('#skyCanvas'),
  labels: $('#skyLabels'),
  engineStatus: $('#engineStatus'),
  renderStatus: $('#renderStatus'),
  localTimeLabel: $('#localTimeLabel'),
  skyHeadline: $('#skyHeadline'),
  observerReadout: $('#observerReadout'),
  visibleReadout: $('#visibleReadout'),
  selectedReadout: $('#selectedReadout'),
  bodyStrip: $('#bodyStrip'),
  encyclopedia: $('#encyclopedia'),
  bodyCategory: $('#bodyCategory'),
  latitude: $('#latitude'),
  longitude: $('#longitude'),
  elevation: $('#elevation'),
  horizonMode: $('#horizonMode'),
  showStars: $('#showStars'),
  showStarNames: $('#showStarNames'),
  showConstellations: $('#showConstellations'),
  showConstellationNames: $('#showConstellationNames'),
  dateTime: $('#dateTime'),
  liveClock: $('#liveClock'),
  setNow: $('#setNow'),
  playPause: $('#playPause'),
  timeSpeed: $('#timeSpeed'),
  trajectoryRange: $('#trajectoryRange'),
  trajectoryStep: $('#trajectoryStep'),
  trajectoryToggles: $('#trajectoryToggles'),
  clearTrajectories: $('#clearTrajectories'),
  forecastRange: $('#forecastRange'),
  eventList: $('#eventList'),
  refreshEvents: $('#refreshEvents'),
  exportEventsJson: $('#exportEventsJson'),
  exportEventsIcs: $('#exportEventsIcs'),
  importEvents: $('#importEvents'),
  useBrowserLocation: $('#useBrowserLocation'),
  resetView: $('#resetView'),
  centerSelected: $('#centerSelected'),
  toggleLabels: $('#toggleLabels'),
  viewDirectionLabel: $('#viewDirectionLabel')
};

const state = {
  date: new Date(),
  observer: { lat: 51.4769, lon: 0.0005, elevation: 46 },
  selectedId: 'Sun',
  playing: false,
  liveClock: true,
  showLabels: true,
  showStars: true,
  showStarNames: true,
  showConstellations: true,
  showConstellationNames: true,
  horizonMode: 'visible',
  bodyStates: [],
  starStates: [],
  activeTrajectories: new Set(),
  events: [],
  importedEvents: [],
  lastFrame: performance.now(),
  lastLiveUpdate: 0,
  lastTrajectoryUpdate: 0,
  eventTimer: 0,
  engineReady: false
};

const gl = {
  scene: null,
  camera: null,
  renderer: null,
  bodyGroup: null,
  trajectoryGroup: null,
  constellationGroup: null,
  starPoints: null,
  starGeometry: null,
  meshes: new Map(),
  labelEls: new Map(),
  starLabelEls: new Map(),
  constellationLabelEls: new Map(),
  constellationLines: new Map(),
  trajectoryLines: new Map(),
  drag: null,
  cameraOrbit: { az: 0, elev: 0.22, dist: 70 }
};

init();

function init() {
  state.engineReady = Boolean(window.Astronomy);
  dom.engineStatus.textContent = state.engineReady ? 'Astronomy Engine active' : 'Fallback sky model';

  setDateInput(state.date);
  bindControls();
  renderBodyStrip();
  renderTrajectoryControls();
  renderEncyclopedia();

  if (!window.THREE) {
    dom.renderStatus.textContent = 'WebGL library missing';
    dom.renderStatus.classList.remove('alt');
    dom.canvas.replaceWith(errorBlock('Three.js did not load. Check your network connection and reload.'));
    updateSkyData();
    refreshEvents();
    return;
  }

  initThree();
  updateSkyData();
  centerSelectedBody();
  refreshEvents();
  requestAnimationFrame(animate);
}

function bindControls() {
  dom.dateTime.addEventListener('change', () => {
    const next = new Date(dom.dateTime.value);
    if (!Number.isNaN(next.valueOf())) {
      state.date = next;
      setLiveClock(false);
      updateSkyData();
      scheduleEventsRefresh();
    }
  });

  dom.setNow.addEventListener('click', () => {
    state.date = new Date();
    setLiveClock(true);
    setDateInput(state.date);
    updateSkyData();
    scheduleEventsRefresh();
  });

  document.querySelectorAll('[data-step]').forEach((button) => {
    button.addEventListener('click', () => {
      state.date = new Date(state.date.getTime() + Number(button.dataset.step) * 1000);
      setLiveClock(false);
      setDateInput(state.date);
      updateSkyData();
      scheduleEventsRefresh();
    });
  });

  dom.playPause.addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.playing) {
      setLiveClock(false);
    }
    dom.playPause.textContent = state.playing ? 'Pause' : 'Play';
  });

  dom.liveClock.addEventListener('change', () => {
    setLiveClock(dom.liveClock.checked);
    if (state.liveClock) {
      state.date = new Date();
      setDateInput(state.date);
      updateSkyData();
      scheduleEventsRefresh();
    }
  });

  [dom.latitude, dom.longitude, dom.elevation].forEach((input) => {
    input.addEventListener('change', () => {
      state.observer = readObserver();
      updateSkyData();
      scheduleEventsRefresh();
    });
  });

  dom.horizonMode.addEventListener('change', () => {
    state.horizonMode = dom.horizonMode.value;
    updateSkyData();
  });

  [
    [dom.showStars, 'showStars'],
    [dom.showStarNames, 'showStarNames'],
    [dom.showConstellations, 'showConstellations'],
    [dom.showConstellationNames, 'showConstellationNames']
  ].forEach(([control, key]) => {
    control.addEventListener('change', () => {
      state[key] = control.checked;
      updateLayerVisibility();
      updateLabels();
    });
  });

  [dom.trajectoryRange, dom.trajectoryStep].forEach((control) => {
    control.addEventListener('change', () => updateActiveTrajectories(true));
  });

  dom.clearTrajectories.addEventListener('click', () => {
    state.activeTrajectories.clear();
    renderTrajectoryControls();
    updateActiveTrajectories(true);
  });

  dom.refreshEvents.addEventListener('click', refreshEvents);
  dom.forecastRange.addEventListener('change', refreshEvents);
  dom.exportEventsJson.addEventListener('click', exportEventsJson);
  dom.exportEventsIcs.addEventListener('click', exportEventsIcs);
  dom.importEvents.addEventListener('change', importEventsFile);
  dom.resetView.addEventListener('click', () => {
    gl.cameraOrbit = { az: 0, elev: 0.22, dist: 70 };
    updateCamera();
  });
  dom.centerSelected.addEventListener('click', centerSelectedBody);

  document.querySelectorAll('[data-view-az]').forEach((button) => {
    button.addEventListener('click', () => {
      gl.cameraOrbit.az = THREE.MathUtils.degToRad(Number(button.dataset.viewAz));
      gl.cameraOrbit.elev = 0.12;
      updateCamera();
    });
  });

  dom.toggleLabels.addEventListener('click', () => {
    state.showLabels = !state.showLabels;
    dom.toggleLabels.classList.toggle('active', state.showLabels);
    dom.labels.classList.toggle('hidden', !state.showLabels);
  });

  dom.useBrowserLocation.addEventListener('click', () => {
    if (!navigator.geolocation) {
      dom.useBrowserLocation.textContent = 'Unavailable';
      return;
    }
    dom.useBrowserLocation.textContent = 'Locating';
    navigator.geolocation.getCurrentPosition((pos) => {
      dom.latitude.value = pos.coords.latitude.toFixed(4);
      dom.longitude.value = pos.coords.longitude.toFixed(4);
      dom.elevation.value = Number.isFinite(pos.coords.altitude) ? Math.round(pos.coords.altitude) : 0;
      state.observer = readObserver();
      dom.useBrowserLocation.textContent = 'Location set';
      updateSkyData();
      scheduleEventsRefresh();
    }, () => {
      dom.useBrowserLocation.textContent = 'Permission denied';
    }, { enableHighAccuracy: false, timeout: 7000, maximumAge: 600000 });
  });
}

function initThree() {
  gl.scene = new THREE.Scene();
  gl.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
  gl.renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  gl.renderer.setClearColor(0x020204, 1);
  gl.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  gl.bodyGroup = new THREE.Group();
  gl.scene.add(gl.bodyGroup);
  gl.constellationGroup = new THREE.Group();
  gl.scene.add(gl.constellationGroup);
  gl.trajectoryGroup = new THREE.Group();
  gl.scene.add(gl.trajectoryGroup);

  createDome();
  createSkyGrid();
  createStars();
  createConstellations();
  createBodies();
  bindCanvasControls();
  resizeRenderer();
  updateCamera();

  window.addEventListener('resize', resizeRenderer);
}

function createDome() {
  const geometry = new THREE.SphereGeometry(DOME_RADIUS, 96, 36, 0, Math.PI * 2, 0, Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color('#07111f') },
      horizon: { value: new THREE.Color('#1a1512') }
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = normalize(world.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 zenith;
      uniform vec3 horizon;
      void main() {
        float t = clamp(vWorld.y, 0.0, 1.0);
        vec3 col = mix(horizon, zenith, smoothstep(0.0, 1.0, t));
        float haze = pow(1.0 - t, 3.0) * 0.12;
        gl_FragColor = vec4(col + haze, 1.0);
      }
    `
  });
  gl.scene.add(new THREE.Mesh(geometry, material));
}

function createSkyGrid() {
  const gridGroup = new THREE.Group();
  const ringMaterial = new THREE.LineBasicMaterial({ color: 0x5f574f, transparent: true, opacity: 0.5 });
  const meridianMaterial = new THREE.LineBasicMaterial({ color: 0x3e7d80, transparent: true, opacity: 0.28 });

  [0, 15, 30, 45, 60].forEach((alt) => {
    const points = [];
    for (let az = 0; az <= 360; az += 3) {
      points.push(altAzToVector(alt, az, BODY_RADIUS));
    }
    gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ringMaterial));
  });

  for (let az = 0; az < 360; az += 30) {
    const points = [];
    for (let alt = 0; alt <= 88; alt += 3) {
      points.push(altAzToVector(alt, az, BODY_RADIUS));
    }
    gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), meridianMaterial));
  }

  ['N', 'E', 'S', 'W'].forEach((letter, index) => {
    const az = index * 90;
    const sprite = makeTextSprite(letter, index % 2 ? '#bffdfa' : '#ffe8ad');
    sprite.position.copy(altAzToVector(0, az, BODY_RADIUS + 2));
    sprite.scale.set(5, 2.5, 1);
    gridGroup.add(sprite);
  });

  gl.scene.add(gridGroup);
}

function createStars() {
  const count = STAR_CATALOG.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const colorWarm = new THREE.Color('#fff0c7');
  const colorCool = new THREE.Color('#b8eaff');

  STAR_CATALOG.forEach((star, i) => {
    positions[i * 3] = 9999;
    positions[i * 3 + 1] = 9999;
    positions[i * 3 + 2] = 9999;
    const c = star.dec > 0 ? colorCool : colorWarm;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.8,
    map: makeStarTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    alphaTest: 0.15,
    depthWrite: false
  });
  gl.starGeometry = geometry;
  gl.starPoints = new THREE.Points(geometry, material);
  gl.scene.add(gl.starPoints);

  STAR_CATALOG.slice(0, 18).forEach((star) => {
    const label = document.createElement('span');
    label.className = 'sky-label star-label';
    label.textContent = star.name;
    dom.labels.append(label);
    gl.starLabelEls.set(star.name, label);
  });
}

function createConstellations() {
  CONSTELLATIONS.forEach((constellation) => {
    const label = document.createElement('span');
    label.className = 'sky-label constellation-label';
    label.textContent = constellation.name;
    dom.labels.append(label);
    gl.constellationLabelEls.set(constellation.id, label);
  });
}

function createBodies() {
  BODY_DATA.forEach((body) => {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(body.color) });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(body.radius, 32, 16), material);
    group.add(mesh);

    const glow = makeGlowSprite(body.color);
    glow.scale.set(8 + body.radius * 5, 8 + body.radius * 5, 1);
    group.add(glow);

    if (body.id === 'Saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.3, 2.1, 48),
        new THREE.MeshBasicMaterial({ color: body.color, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
      );
      ring.rotation.x = Math.PI / 2.8;
      group.add(ring);
    }

    const label = document.createElement('span');
    label.className = 'sky-label';
    label.textContent = body.name;
    dom.labels.append(label);

    gl.meshes.set(body.id, group);
    gl.labelEls.set(body.id, label);
    gl.bodyGroup.add(group);
  });
}

function bindCanvasControls() {
  dom.canvas.addEventListener('pointerdown', (event) => {
    dom.canvas.setPointerCapture(event.pointerId);
    gl.drag = {
      x: event.clientX,
      y: event.clientY,
      az: gl.cameraOrbit.az,
      elev: gl.cameraOrbit.elev
    };
  });

  dom.canvas.addEventListener('pointermove', (event) => {
    if (!gl.drag) return;
    const dx = event.clientX - gl.drag.x;
    const dy = event.clientY - gl.drag.y;
    gl.cameraOrbit.az = gl.drag.az + dx * 0.006;
    gl.cameraOrbit.elev = clamp(gl.drag.elev + dy * 0.004, -0.28, 1.22);
    updateCamera();
  });

  dom.canvas.addEventListener('pointerup', () => {
    gl.drag = null;
  });

  dom.canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    gl.camera.fov = clamp(gl.camera.fov + event.deltaY * 0.025, 34, 82);
    gl.camera.updateProjectionMatrix();
  }, { passive: false });
}

function updateCamera() {
  if (!gl.camera) return;
  const { az, elev } = gl.cameraOrbit;
  const flat = Math.cos(elev);
  const target = new THREE.Vector3(
    Math.sin(az) * flat,
    Math.sin(elev),
    -Math.cos(az) * flat
  );
  gl.camera.position.set(0, 0, 0);
  gl.camera.lookAt(target);
  dom.viewDirectionLabel.textContent = `Facing ${azimuthToCompass(THREE.MathUtils.radToDeg(az))}`;
}

function centerSelectedBody() {
  if (!gl.camera) return;
  let selected = bodyStateById(state.selectedId);
  if (selected && !selected.visible && state.horizonMode !== 'all') {
    selected = state.bodyStates.find((body) => body.visible) || selected;
  }
  if (!selected) return;
  gl.cameraOrbit.az = THREE.MathUtils.degToRad(selected.az);
  gl.cameraOrbit.elev = THREE.MathUtils.degToRad(clamp(selected.alt, state.horizonMode === 'all' ? -10 : 6, 82));
  updateCamera();
}

function updateSkyData() {
  state.observer = readObserver();
  state.bodyStates = calculateBodies(state.date, state.observer);
  state.starStates = calculateStars(state.date, state.observer);
  updateBodyMeshes();
  updateStarPoints();
  updateConstellationLines();
  updateActiveTrajectories(false);
  updateReadouts();
  renderBodyStrip();
  renderEncyclopedia();
}

function calculateBodies(date, observer) {
  if (!window.Astronomy) {
    return fallbackBodies(date);
  }

  const obs = new Astronomy.Observer(observer.lat, observer.lon, observer.elevation);
  return BODY_DATA.map((body) => {
    try {
      const equ = Astronomy.Equator(body.astro, date, obs, true, true);
      const hor = Astronomy.Horizon(date, obs, equ.ra, equ.dec, 'normal');
      const distanceAu = geoDistance(body.astro, date);
      const moonPhase = body.id === 'Moon' && Astronomy.MoonPhase ? Astronomy.MoonPhase(date) : null;
      return {
        id: body.id,
        alt: hor.altitude,
        az: normalizeDegrees(hor.azimuth),
        ra: equ.ra,
        dec: equ.dec,
        visible: hor.altitude > 0,
        distanceAu,
        moonPhase
      };
    } catch (error) {
      return fallbackBodyFor(body, date);
    }
  });
}

function fallbackBodies(date) {
  return BODY_DATA.map((body) => fallbackBodyFor(body, date));
}

function fallbackBodyFor(body, date) {
  const day = date.getTime() / 86400000;
  const index = BODY_DATA.findIndex((item) => item.id === body.id) + 1;
  const az = normalizeDegrees(day * (4 + index * 0.38) + index * 37);
  const alt = 24 + Math.sin(day * 0.28 + index) * 34;
  return {
    id: body.id,
    alt,
    az,
    ra: 0,
    dec: 0,
    visible: alt > 0,
    distanceAu: null,
    moonPhase: body.id === 'Moon' ? normalizeDegrees(day * 12.19) : null
  };
}

function geoDistance(body, date) {
  if (!Astronomy.GeoVector) return null;
  const vector = Astronomy.GeoVector(body, date, true);
  return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
}

function calculateStars(date, observer) {
  if (!window.Astronomy) {
    return STAR_CATALOG.map((star, index) => {
      const day = date.getTime() / 86400000;
      const alt = 35 + Math.sin(day * 0.08 + index) * 38;
      return { ...star, alt, az: normalizeDegrees(star.ra * 15 + day * 0.9856), visible: alt > 0 };
    });
  }

  const obs = new Astronomy.Observer(observer.lat, observer.lon, observer.elevation);
  return STAR_CATALOG.map((star) => {
    try {
      const hor = Astronomy.Horizon(date, obs, star.ra, star.dec, 'normal');
      return {
        ...star,
        alt: hor.altitude,
        az: normalizeDegrees(hor.azimuth),
        visible: hor.altitude > 0
      };
    } catch (error) {
      return { ...star, alt: -90, az: 0, visible: false };
    }
  });
}

function updateBodyMeshes() {
  if (!gl.bodyGroup) return;
  const selected = state.selectedId;
  state.bodyStates.forEach((bodyState) => {
    const mesh = gl.meshes.get(bodyState.id);
    const label = gl.labelEls.get(bodyState.id);
    const include = state.horizonMode === 'all' || bodyState.visible;
    if (!mesh || !label) return;

    mesh.visible = include;
    label.style.display = include ? 'block' : 'none';
    if (!include) return;

    const alt = state.horizonMode === 'all' ? clamp(bodyState.alt, -12, 90) : bodyState.alt;
    mesh.position.copy(altAzToVector(alt, bodyState.az, BODY_RADIUS));
    const selectedScale = bodyState.id === selected ? 1.32 : 1;
    mesh.scale.setScalar((bodyState.visible ? 1 : 0.62) * selectedScale);
    mesh.children.forEach((child) => {
      if (child.material && 'opacity' in child.material) {
        child.material.opacity = bodyState.visible ? 0.78 : 0.25;
      }
    });
  });
}

function updateStarPoints() {
  if (!gl.starGeometry) return;
  const positions = gl.starGeometry.getAttribute('position');
  if (gl.starPoints) gl.starPoints.visible = state.showStars;
  state.starStates.forEach((star, index) => {
    const label = gl.starLabelEls.get(star.name);
    if (!star.visible) {
      positions.setXYZ(index, 9999, 9999, 9999);
      if (label) label.style.display = 'none';
      return;
    }

    const vector = altAzToVector(star.alt, star.az, DOME_RADIUS - 2);
    positions.setXYZ(index, vector.x, vector.y, vector.z);
  });
  positions.needsUpdate = true;
}

function updateConstellationLines() {
  if (!gl.constellationGroup) return;
  gl.constellationLines.forEach((line) => {
    gl.constellationGroup.remove(line);
    disposeLine(line);
  });
  gl.constellationLines.clear();

  if (!state.showConstellations) {
    return;
  }

  const byName = new Map(state.starStates.map((star) => [star.name, star]));
  CONSTELLATIONS.forEach((constellation) => {
    const group = new THREE.Group();
    constellation.lines.forEach(([fromName, toName]) => {
      const from = byName.get(fromName);
      const to = byName.get(toName);
      if (!from || !to || !from.visible || !to.visible) return;
      const points = [
        altAzToVector(from.alt, from.az, DOME_RADIUS - 3.2),
        altAzToVector(to.alt, to.az, DOME_RADIUS - 3.2)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x8fb7ff,
        transparent: true,
        opacity: 0.38
      });
      group.add(new THREE.Line(geometry, material));
    });
    if (!group.children.length) return;
    gl.constellationLines.set(constellation.id, group);
    gl.constellationGroup.add(group);
  });
}

function updateLayerVisibility() {
  if (gl.starPoints) gl.starPoints.visible = state.showStars;
  if (gl.constellationGroup) gl.constellationGroup.visible = state.showConstellations;
  if (state.showConstellations) updateConstellationLines();
}

function updateLabels() {
  if (!gl.camera || !gl.renderer) return;
  const width = dom.canvas.clientWidth;
  const height = dom.canvas.clientHeight;
  const selected = state.selectedId;
  state.bodyStates.forEach((bodyState) => {
    const group = gl.meshes.get(bodyState.id);
    const label = gl.labelEls.get(bodyState.id);
    if (!group || !label || !group.visible || !state.showLabels) {
      if (label) label.style.display = 'none';
      return;
    }

    const worldPosition = new THREE.Vector3();
    group.updateWorldMatrix(true, false);
    group.getWorldPosition(worldPosition);
    const projected = worldPosition.project(gl.camera);
    const inFront = projected.z > -1 && projected.z < 1;
    if (!inFront) {
      label.style.display = 'none';
      return;
    }

    label.style.display = 'block';
    label.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    label.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    label.style.borderColor = bodyState.id === selected ? 'rgba(255, 200, 90, 0.72)' : 'rgba(255, 255, 255, 0.18)';
  });

  state.starStates.slice(0, 18).forEach((star) => {
    const label = gl.starLabelEls.get(star.name);
    if (!label || !star.visible || !state.showLabels || !state.showStars || !state.showStarNames) {
      if (label) label.style.display = 'none';
      return;
    }
    const projected = altAzToVector(star.alt, star.az, DOME_RADIUS - 2).project(gl.camera);
    if (projected.z <= -1 || projected.z >= 1) {
      label.style.display = 'none';
      return;
    }
    label.style.display = 'block';
    label.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    label.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
  });

  updateConstellationLabels(width, height);
}

function updateConstellationLabels(width, height) {
  const byName = new Map(state.starStates.map((star) => [star.name, star]));
  CONSTELLATIONS.forEach((constellation) => {
    const label = gl.constellationLabelEls.get(constellation.id);
    if (!label || !state.showLabels || !state.showConstellations || !state.showConstellationNames) {
      if (label) label.style.display = 'none';
      return;
    }

    const visible = [];
    constellation.lines.forEach(([fromName, toName]) => {
      const from = byName.get(fromName);
      const to = byName.get(toName);
      if (from && from.visible) visible.push(from);
      if (to && to.visible) visible.push(to);
    });

    if (visible.length < 2) {
      label.style.display = 'none';
      return;
    }

    const center = visible.reduce((acc, star) => {
      acc.add(altAzToVector(star.alt, star.az, DOME_RADIUS - 4));
      return acc;
    }, new THREE.Vector3()).multiplyScalar(1 / visible.length);

    const projected = center.project(gl.camera);
    if (projected.z <= -1 || projected.z >= 1) {
      label.style.display = 'none';
      return;
    }

    label.style.display = 'block';
    label.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    label.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
  });
}

function updateReadouts() {
  const visible = state.bodyStates.filter((body) => body.visible);
  const selected = bodyStateById(state.selectedId);
  const selectedInfo = selected
    ? `${selected.alt.toFixed(1)} deg alt, ${selected.az.toFixed(0)} deg az`
    : '--';
  dom.localTimeLabel.textContent = state.date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  dom.skyHeadline.textContent = `Sky from ${state.observer.lat.toFixed(2)} deg, ${state.observer.lon.toFixed(2)} deg`;
  dom.observerReadout.textContent = `${state.observer.lat.toFixed(3)}, ${state.observer.lon.toFixed(3)}`;
  dom.visibleReadout.textContent = visible.length ? visible.map((body) => body.id).join(', ') : 'None above horizon';
  dom.selectedReadout.textContent = selectedInfo;
}

function renderBodyStrip() {
  dom.bodyStrip.innerHTML = '';
  BODY_DATA.forEach((body) => {
    const bodyState = bodyStateById(body.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `body-button${body.id === state.selectedId ? ' active' : ''}`;
    button.style.setProperty('--body-color', body.color);
    button.innerHTML = `
      <strong><i class="body-dot" aria-hidden="true"></i>${body.name}</strong>
      <span>${bodyState ? formatBodyPosition(bodyState) : 'Calculating'}</span>
    `;
    button.addEventListener('click', () => {
      state.selectedId = body.id;
      renderBodyStrip();
      renderEncyclopedia();
      updateBodyMeshes();
      updateReadouts();
      centerSelectedBody();
    });
    dom.bodyStrip.append(button);
  });
}

function renderTrajectoryControls() {
  dom.trajectoryToggles.innerHTML = '';
  BODY_DATA.forEach((body) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `trajectory-toggle${state.activeTrajectories.has(body.id) ? ' active' : ''}`;
    button.style.setProperty('--body-color', body.color);
    button.innerHTML = `<i class="body-dot" aria-hidden="true"></i><span>${body.name}</span>`;
    button.addEventListener('click', () => {
      if (state.activeTrajectories.has(body.id)) {
        state.activeTrajectories.delete(body.id);
      } else {
        state.activeTrajectories.add(body.id);
      }
      renderTrajectoryControls();
      updateActiveTrajectories(true);
    });
    dom.trajectoryToggles.append(button);
  });
}

function updateActiveTrajectories(force) {
  if (!gl.trajectoryGroup) return;
  const now = performance.now();
  if (!force && state.playing && now - state.lastTrajectoryUpdate < 1000) return;
  if (!force && now - state.lastTrajectoryUpdate < 240) return;
  state.lastTrajectoryUpdate = now;

  gl.trajectoryLines.forEach((line, id) => {
    if (!state.activeTrajectories.has(id)) {
      gl.trajectoryGroup.remove(line);
      disposeLine(line);
      gl.trajectoryLines.delete(id);
    }
  });

  state.activeTrajectories.forEach((id) => {
    const body = BODY_DATA.find((item) => item.id === id);
    if (!body) return;
    const segments = calculateTrajectory(body);
    const existing = gl.trajectoryLines.get(id);
    if (existing) {
      gl.trajectoryGroup.remove(existing);
      disposeLine(existing);
    }
    if (!segments.length) return;
    const group = new THREE.Group();
    segments.forEach((points) => {
      if (points.length < 2) return;
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(body.color),
        transparent: true,
        opacity: 0.78
      });
      group.add(new THREE.Line(geometry, material));
    });
    if (!group.children.length) return;
    gl.trajectoryLines.set(id, group);
    gl.trajectoryGroup.add(group);
  });
}

function calculateTrajectory(body) {
  const segments = [];
  let points = [];
  const days = Number(dom.trajectoryRange.value);
  const stepSeconds = Number(dom.trajectoryStep.value);
  const start = new Date(state.date);
  const end = new Date(start.getTime() + days * 86400000);
  const obs = window.Astronomy ? new Astronomy.Observer(state.observer.lat, state.observer.lon, state.observer.elevation) : null;

  for (let t = start.getTime(); t <= end.getTime(); t += stepSeconds * 1000) {
    const sampleDate = new Date(t);
    let alt;
    let az;
    if (window.Astronomy && obs) {
      const equ = safeCall(() => Astronomy.Equator(body.astro, sampleDate, obs, true, true));
      const hor = equ ? safeCall(() => Astronomy.Horizon(sampleDate, obs, equ.ra, equ.dec, 'normal')) : null;
      if (!hor) continue;
      alt = hor.altitude;
      az = normalizeDegrees(hor.azimuth);
    } else {
      const fallback = fallbackBodyFor(body, sampleDate);
      alt = fallback.alt;
      az = fallback.az;
    }

    if (state.horizonMode !== 'all' && alt < 0) {
      if (points.length > 1) segments.push(points);
      points = [];
      continue;
    }
    points.push(altAzToVector(clamp(alt, -12, 90), az, BODY_RADIUS - 1.5));
  }
  if (points.length > 1) segments.push(points);
  return segments;
}

function disposeLine(object) {
  object.traverse((item) => {
    if (item.geometry) item.geometry.dispose();
    if (item.material) item.material.dispose();
  });
}

function renderEncyclopedia() {
  const body = BODY_DATA.find((item) => item.id === state.selectedId) || BODY_DATA[0];
  const live = bodyStateById(body.id);
  dom.bodyCategory.textContent = body.category;
  const phaseText = live && live.moonPhase !== null && live.moonPhase !== undefined
    ? `<div class="fact"><span>Moon phase angle</span><strong>${live.moonPhase.toFixed(1)} deg</strong></div>`
    : '';
  const distanceText = live && live.distanceAu
    ? `<div class="fact"><span>Geocentric distance</span><strong>${formatDistance(live.distanceAu, body.id)}</strong></div>`
    : '';
  dom.encyclopedia.innerHTML = `
    <h3>${body.name}</h3>
    <p>${body.summary}</p>
    <div class="fact-grid">
      <div class="fact"><span>Current altitude</span><strong>${live ? `${live.alt.toFixed(1)} deg` : '--'}</strong></div>
      <div class="fact"><span>Current azimuth</span><strong>${live ? `${live.az.toFixed(1)} deg` : '--'}</strong></div>
      ${distanceText}
      ${phaseText}
      ${body.facts.map(([key, value]) => `<div class="fact"><span>${key}</span><strong>${value}</strong></div>`).join('')}
    </div>
  `;
}

function refreshEvents() {
  dom.eventList.innerHTML = '<div class="event-card"><strong>Calculating events</strong><span>Searching forward from the selected timeline date.</span></div>';
  window.clearTimeout(state.eventTimer);
  state.eventTimer = window.setTimeout(() => {
    state.events = state.engineReady && window.Astronomy ? calculateEvents() : fallbackEvents();
    renderEvents(mergedEvents());
  }, 30);
}

function scheduleEventsRefresh() {
  window.clearTimeout(state.eventTimer);
  state.eventTimer = window.setTimeout(refreshEvents, 400);
}

function calculateEvents() {
  const events = [];
  const date = state.date;
  const end = new Date(date.getTime() + Number(dom.forecastRange.value) * 86400000);
  const obs = new Astronomy.Observer(state.observer.lat, state.observer.lon, state.observer.elevation);

  pushEvent(events, safeCall(() => Astronomy.SearchLocalSolarEclipse(date, obs)), 'Local solar eclipse', 'When a solar eclipse is visible from the current observer location.');
  pushEvent(events, safeCall(() => Astronomy.SearchGlobalSolarEclipse(date)), 'Global solar eclipse', 'Next solar eclipse somewhere on Earth.');
  pushEvent(events, safeCall(() => Astronomy.SearchLunarEclipse(date)), 'Lunar eclipse', 'Earths shadow crossing the Moon.');
  pushEvent(events, safeCall(() => Astronomy.SearchTransit('Mercury', date)), 'Mercury transit', 'Mercury crossing the face of the Sun.');
  pushEvent(events, safeCall(() => Astronomy.SearchTransit('Venus', date)), 'Venus transit', 'Venus crossing the face of the Sun.');

  let quarter = safeCall(() => Astronomy.SearchMoonQuarter(date));
  for (let i = 0; quarter && i < 24; i += 1) {
    const label = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'][quarter.quarter] || 'Moon quarter';
    pushEvent(events, quarter, label, 'Lunar phase checkpoint.');
    if (extractEventDate(quarter) > end) break;
    quarter = safeCall(() => Astronomy.NextMoonQuarter(quarter));
  }

  let apsis = safeCall(() => Astronomy.SearchLunarApsis(date));
  for (let i = 0; apsis && i < 18; i += 1) {
    pushEvent(events, apsis, apsis.kind === 0 ? 'Moon perigee' : 'Moon apogee', 'Closest or farthest Moon distance in the current cycle.', { includeKind: false });
    if (extractEventDate(apsis) > end) break;
    apsis = safeCall(() => Astronomy.NextLunarApsis(apsis));
  }

  return events
    .filter((event) => event.date && event.date >= date && event.date <= end)
    .sort((a, b) => a.date - b.date)
    .slice(0, 18)
    .map((event, index) => ({ ...event, id: `computed-${index}` }));
}

function pushEvent(events, raw, title, description, options = {}) {
  const date = extractEventDate(raw);
  if (!date) return;
  const includeKind = options.includeKind !== false;
  const kind = includeKind && raw && raw.kind !== undefined ? ` Type: ${formatKind(raw.kind)}.` : '';
  const distance = raw && raw.dist_km ? ` Distance: ${Math.round(raw.dist_km).toLocaleString()} km.` : '';
  events.push({
    title,
    date,
    description: `${description}${kind}${distance}`,
    source: 'computed'
  });
}

function fallbackEvents() {
  return [
    {
      title: 'Event search unavailable',
      date: state.date,
      description: 'Astronomy Engine did not load, so eclipse and transit predictions are disabled. The sky view is running with approximate placeholder motion.',
      source: 'system',
      id: 'fallback-0'
    }
  ];
}

function renderEvents(events) {
  dom.eventList.innerHTML = '';
  if (!events.length) {
    dom.eventList.innerHTML = '<div class="event-card"><strong>No events found</strong><span>Try a longer search range or import calendar dates.</span></div>';
    return;
  }
  events.forEach((event) => {
    const card = document.createElement('article');
    card.className = 'event-card';
    const dateIso = event.date.toISOString();
    card.innerHTML = `
      <div class="event-card-head">
        <strong>${event.title}</strong>
        <button class="small-button event-jump" type="button" data-date="${dateIso}">Go</button>
      </div>
      <span>${event.date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}<br>${event.description}</span>
    `;
    dom.eventList.append(card);
  });

  dom.eventList.querySelectorAll('.event-jump').forEach((button) => {
    button.addEventListener('click', () => {
      const next = new Date(button.dataset.date);
      if (Number.isNaN(next.valueOf())) return;
      state.date = next;
      setLiveClock(false);
      state.playing = false;
      dom.playPause.textContent = 'Play';
      setDateInput(state.date);
      updateSkyData();
    });
  });
}

function mergedEvents() {
  const start = state.date;
  const end = new Date(start.getTime() + Number(dom.forecastRange.value) * 86400000);
  return [...state.events, ...state.importedEvents]
    .filter((event) => event.date && event.date >= start && event.date <= end)
    .sort((a, b) => a.date - b.date);
}

function exportEventsJson() {
  const payload = {
    app: 'Planetary Calendar',
    exportedAt: new Date().toISOString(),
    observer: readObserver(),
    timelineDate: state.date.toISOString(),
    forecastRangeDays: Number(dom.forecastRange.value),
    events: mergedEvents().map(serializeEvent)
  };
  downloadText(`planetary-calendar-${dateStamp(new Date())}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

function exportEventsIcs() {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Graphics Pages//Planetary Calendar//EN',
    'CALSCALE:GREGORIAN'
  ];
  mergedEvents().forEach((event, index) => {
    const start = event.date;
    const end = new Date(start.getTime() + 3600000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:planetary-calendar-${index}-${start.getTime()}@graphics-pages`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(event.description || '')}`,
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  downloadText(`planetary-calendar-${dateStamp(new Date())}.ics`, lines.join('\r\n'), 'text/calendar');
}

function importEventsFile() {
  const file = dom.importEvents.files && dom.importEvents.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || '');
      const imported = file.name.toLowerCase().endsWith('.json') ? parseJsonEvents(text) : parseIcsEvents(text);
      state.importedEvents = imported.map((event, index) => ({
        ...event,
        id: `imported-${Date.now()}-${index}`,
        source: 'imported'
      }));
      renderEvents(mergedEvents());
    } catch (error) {
      dom.eventList.innerHTML = '<div class="event-card"><strong>Import failed</strong><span>The selected file was not a readable Planetary Calendar JSON or ICS calendar.</span></div>';
    }
    dom.importEvents.value = '';
  };
  reader.readAsText(file);
}

function parseJsonEvents(text) {
  const parsed = JSON.parse(text);
  const source = Array.isArray(parsed) ? parsed : parsed.events;
  if (!Array.isArray(source)) return [];
  return source.map((event) => ({
    title: String(event.title || event.summary || 'Imported event'),
    date: new Date(event.date || event.start || event.dtstart),
    description: String(event.description || event.notes || 'Imported calendar date.')
  })).filter((event) => !Number.isNaN(event.date.valueOf()));
}

function parseIcsEvents(text) {
  const normalized = text.replace(/\r\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let current = null;
  normalized.forEach((line) => {
    if (line === 'BEGIN:VEVENT') current = {};
    if (line === 'END:VEVENT' && current) {
      const date = parseIcsDate(current.DTSTART || current['DTSTART;VALUE=DATE']);
      if (date) {
        events.push({
          title: current.SUMMARY || 'Imported event',
          date,
          description: current.DESCRIPTION || 'Imported calendar date.'
        });
      }
      current = null;
      return;
    }
    if (!current || !line.includes(':')) return;
    const split = line.indexOf(':');
    const key = line.slice(0, split);
    const baseKey = key.split(';')[0];
    current[baseKey] = unescapeIcs(line.slice(split + 1));
  });
  return events;
}

function parseIcsDate(value) {
  if (!value) return null;
  const clean = value.trim();
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!match) return null;
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  if (clean.includes('T') && clean.endsWith('Z')) {
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  }
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
}

function animate(now) {
  const dt = Math.min((now - state.lastFrame) / 1000, 0.1);
  state.lastFrame = now;

  if (state.playing) {
    state.date = new Date(state.date.getTime() + dt * Number(dom.timeSpeed.value) * 1000);
    setDateInput(state.date);
    updateSkyData();
  } else if (state.liveClock && now - state.lastLiveUpdate > 1000) {
    state.lastLiveUpdate = now;
    state.date = new Date();
    setDateInput(state.date);
    updateSkyData();
  }

  if (gl.bodyGroup) {
    gl.meshes.forEach((group) => {
      group.children.forEach((child) => {
        if (child.geometry && child.geometry.type === 'SphereGeometry') {
          child.rotation.y += dt * 0.5;
        }
      });
    });
  }

  resizeRenderer();
  if (gl.renderer && gl.scene && gl.camera) {
    gl.renderer.render(gl.scene, gl.camera);
    updateLabels();
  }
  requestAnimationFrame(animate);
}

function resizeRenderer() {
  if (!gl.renderer || !gl.camera) return;
  const width = dom.canvas.clientWidth;
  const height = dom.canvas.clientHeight;
  const size = gl.renderer.getSize(new THREE.Vector2());
  if (size.x !== width || size.y !== height) {
    gl.renderer.setSize(width, height, false);
    gl.camera.aspect = width / Math.max(height, 1);
    gl.camera.updateProjectionMatrix();
  }
}

function readObserver() {
  return {
    lat: clamp(Number(dom.latitude.value) || 0, -90, 90),
    lon: clamp(Number(dom.longitude.value) || 0, -180, 180),
    elevation: clamp(Number(dom.elevation.value) || 0, -500, 9000)
  };
}

function setLiveClock(enabled) {
  state.liveClock = Boolean(enabled);
  dom.liveClock.checked = state.liveClock;
}

function azimuthToCompass(azimuth) {
  const labels = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const index = Math.round(normalizeDegrees(azimuth) / 45) % labels.length;
  return labels[index];
}

function setDateInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  dom.dateTime.value = local.toISOString().slice(0, 16);
}

function altAzToVector(altitude, azimuth, radius) {
  const alt = THREE.MathUtils.degToRad(altitude);
  const az = THREE.MathUtils.degToRad(azimuth);
  const cosAlt = Math.cos(alt);
  return new THREE.Vector3(
    Math.sin(az) * cosAlt * radius,
    Math.sin(alt) * radius,
    -Math.cos(az) * cosAlt * radius
  );
}

function makeTextSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  roundedRect(ctx, 18, 10, 92, 42, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '800 27px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  return new THREE.Sprite(material);
}

function makeGlowSprite(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 60);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.25, `${color}88`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
}

function makeStarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.42, 'rgba(255,255,255,0.78)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function bodyStateById(id) {
  return state.bodyStates.find((body) => body.id === id);
}

function formatBodyPosition(bodyState) {
  const visible = bodyState.visible ? 'visible' : 'below horizon';
  return `${visible} - alt ${bodyState.alt.toFixed(1)} deg`;
}

function formatDistance(au, id) {
  if (id === 'Moon') {
    return `${Math.round(au * 149597870.7).toLocaleString()} km`;
  }
  return `${au.toFixed(4)} AU`;
}

function extractEventDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (raw.date instanceof Date) return raw.date;
  if (raw.time && raw.time.date instanceof Date) return raw.time.date;
  if (raw.peak && raw.peak.date instanceof Date) return raw.peak.date;
  if (raw.start && raw.start.date instanceof Date) return raw.start.date;
  if (raw.time instanceof Date) return raw.time;
  return null;
}

function formatKind(kind) {
  const numeric = Number(kind);
  if (Number.isFinite(numeric)) {
    const names = ['partial', 'annular', 'total', 'penumbral'];
    return names[numeric] || String(kind);
  }
  return String(kind).replace(/_/g, ' ').toLowerCase();
}

function serializeEvent(event) {
  return {
    title: event.title,
    date: event.date.toISOString(),
    description: event.description || '',
    source: event.source || 'computed'
  };
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp(date) {
  return date.toISOString().slice(0, 10);
}

function icsDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function unescapeIcs(value) {
  return String(value)
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function safeCall(callback) {
  try {
    return callback();
  } catch (error) {
    return null;
  }
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function errorBlock(message) {
  const block = document.createElement('div');
  block.className = 'event-card';
  block.style.margin = '24px';
  block.innerHTML = `<strong>Renderer unavailable</strong><span>${message}</span>`;
  return block;
}
