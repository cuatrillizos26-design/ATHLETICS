// @ts-nocheck
/* ============ DATA: events, names, training, achievements ============ */

export const ATTRS = [
  { k: "spd",  n: "Velocidad máxima" },
  { k: "acc",  n: "Aceleración" },
  { k: "aer",  n: "Resist. aeróbica" },
  { k: "ana",  n: "Resist. anaeróbica" },
  { k: "str",  n: "Fuerza" },
  { k: "pow",  n: "Potencia" },
  { k: "kck",  n: "Sprint final" },
  { k: "tec",  n: "Técnica" },
  { k: "eco",  n: "Economía" },
  { k: "stt",  n: "Salida" },
  { k: "rec",  n: "Recuperación" },
  { k: "cmp",  n: "Competitividad" },
  { k: "con",  n: "Consistencia" },
];

export const EV: any = {
  "60":   { d: 60,   g: "spr", wr: 6.34,   k: 0.00345, label: "60 m",    w: { spd:.45, acc:.28, stt:.12, pow:.10, tec:.05 } },
  "100":  { d: 100,  g: "spr", wr: 9.58,   k: 0.00427, label: "100 m",   w: { spd:.35, acc:.25, stt:.12, pow:.12, ana:.08, tec:.08 } },
  "200":  { d: 200,  g: "spr", wr: 19.30,  k: 0.00448, label: "200 m",   w: { spd:.30, acc:.18, ana:.22, tec:.12, pow:.10, stt:.08 } },
  "400":  { d: 400,  g: "spr", wr: 43.03,  k: 0.00460, label: "400 m",   w: { spd:.22, ana:.28, aer:.14, pow:.12, tec:.10, eco:.07, acc:.07 } },
  "800":  { d: 800,  g: "mid", wr: 100.91, k: 0.00370, label: "800 m",   w: { ana:.28, aer:.30, spd:.12, kck:.12, eco:.10, pow:.08 } },
  "1500": { d: 1500, g: "mid", wr: 206.00, k: 0.00520, label: "1500 m",  w: { aer:.40, ana:.14, kck:.16, eco:.16, spd:.09, pow:.05 } },
  "3000": { d: 3000, g: "mid", wr: 440.00, k: 0.00546, label: "3000 m",  w: { aer:.45, eco:.24, ana:.09, kck:.10, spd:.07, pow:.05 } },
  "110H": { d: 110,  g: "hur", wr: 12.80,  k: 0.00513, label: "110 m vallas", w: { tec:.28, spd:.24, acc:.14, pow:.14, stt:.10, ana:.10 }, hurdles: 10, h1: 13.72, hs: 9.14 },
  "400H": { d: 400,  g: "hur", wr: 45.94,  k: 0.00567, label: "400 m vallas", w: { tec:.26, ana:.26, spd:.18, aer:.14, pow:.10, acc:.06 }, hurdles: 10, h1: 45, hs: 35 },
  "300":  { d: 300,  g: "spr", wr: 30.81,  k: 0.00500, label: "300 m",   w: { spd:.26, ana:.30, aer:.12, pow:.12, tec:.10, acc:.10 } },
};
export const RANK_EVENTS = ["60", "100", "200", "400", "800", "1500", "3000", "110H", "400H"];
export const IND_EVENTS = ["60", "100", "200", "400", "800", "1500", "3000", "110H", "400H"];
export const RELAY_EVENTS = ["4x100", "4x400", "SMR"];
export const RELAYS: any = {
  "4x100": { label: "4×100 m", legs: [100, 100, 100, 100], base: "100", zone: true },
  "4x400": { label: "4×400 m", legs: [400, 400, 400, 400], base: "400", zone: false },
  "SMR":   { label: "Sprint Medley", legs: [100, 200, 300, 400], base: null, zone: false },
};

export const SPECS = [
  { id: "vel", n: "Velocista", ev: "100", ev2: "200", desc: "100 / 200 m — pura explosividad" },
  { id: "400", n: "Cuatrocentista", ev: "400", ev2: "200", desc: "400 m — velocidad resistencia" },
  { id: "mid", n: "Mediofondista", ev: "800", ev2: "1500", desc: "800 / 1500 m — táctica y motor" },
  { id: "hur", n: "Vallista", ev: "110H", ev2: "400H", desc: "Vallas — técnica y ritmo" },
];

export const COUNTRIES = [
  { c: "ESP", n: "España", s: 74 }, { c: "USA", n: "Estados Unidos", s: 90 }, { c: "GBR", n: "Reino Unido", s: 84 },
  { c: "FRA", n: "Francia", s: 82 }, { c: "GER", n: "Alemania", s: 80 }, { c: "ITA", n: "Italia", s: 78 },
  { c: "POL", n: "Polonia", s: 77 }, { c: "NED", n: "Países Bajos", s: 76 }, { c: "NOR", n: "Noruega", s: 75 },
  { c: "SWE", n: "Suecia", s: 74 }, { c: "BEL", n: "Bélgica", s: 75 }, { c: "SUI", n: "Suiza", s: 74 },
  { c: "POR", n: "Portugal", s: 73 }, { c: "CZE", n: "Chequia", s: 73 }, { c: "IRL", n: "Irlanda", s: 71 },
  { c: "FIN", n: "Finlandia", s: 71 }, { c: "GRE", n: "Grecia", s: 72 }, { c: "TUR", n: "Turquía", s: 72 },
  { c: "UKR", n: "Ucrania", s: 76 }, { c: "HUN", n: "Hungría", s: 71 }, { c: "DEN", n: "Dinamarca", s: 72 },
  { c: "AUT", n: "Austria", s: 70 }, { c: "MAR", n: "Marruecos", s: 78 }, { c: "ALG", n: "Argelia", s: 74 },
  { c: "KEN", n: "Kenia", s: 88 }, { c: "ETH", n: "Etiopía", s: 87 }, { c: "UGA", n: "Uganda", s: 76 },
  { c: "RSA", n: "Sudáfrica", s: 75 }, { c: "NGR", n: "Nigeria", s: 77 }, { c: "GHA", n: "Ghana", s: 73 },
  { c: "BRA", n: "Brasil", s: 78 }, { c: "ARG", n: "Argentina", s: 72 }, { c: "MEX", n: "México", s: 72 },
  { c: "COL", n: "Colombia", s: 71 }, { c: "CUB", n: "Cuba", s: 76 }, { c: "JAM", n: "Jamaica", s: 86 },
  { c: "TRI", n: "Trinidad y T.", s: 76 }, { c: "CAN", n: "Canadá", s: 79 }, { c: "AUS", n: "Australia", s: 79 },
  { c: "NZL", n: "Nueva Zelanda", s: 73 }, { c: "JPN", n: "Japón", s: 80 }, { c: "CHN", n: "China", s: 79 },
  { c: "KOR", n: "Corea del Sur", s: 74 }, { c: "IND", n: "India", s: 71 }, { c: "QAT", n: "Catar", s: 74 },
  { c: "BHR", n: "Baréin", s: 74 }, { c: "NCA", n: "Nicaragua", s: 62 }, { c: "DOM", n: "R. Dominicana", s: 73 },
];

export const FIRST = ["David","Marco","Álex","Carlos","Mateo","Iker","Pablo","Hugo","Leo","Daniel","Adrián","Javier","Sergio","Raúl","Unai","Marc","Jon","Diego","Andrés","Tomás","Erik","Luka","Noah","Kai","Youssef","Amine","Samuel","Josh","Tyler","Andre","Kofi","Kwame","Tariq","Hassan","Omar","Milan","Piotr","Jan","Lars","Emil","Oscar","Finn","Luca","Matej","Rafael","Bruno","Tiago","Simone","Antoine","Kylian","Dmitri","Ivan","Akira","Ren","Min-jun","Wei","Arjun","Ravi","Alejandro","Felipe","Santiago","Emilio","Gustavo","Nicolás","Cristian","Ismael","Bilal","Reda","Anass","Moussa","Sekou","Abed","Tsegaye","Bekele","Josphat","Kip","Aaron","Elijah","Manuel","Víctor","Óscar","Rubén","Gonzalo","Álvaro","Izan","Aitor"];
export const LAST = ["García","Fernández","López","Martínez","Sánchez","Romero","Torres","Navarro","Vega","Cruz","Moreno","Ortega","Delgado","Ramos","Ibáñez","Silva","Costa","Ferreira","Santos","Oliveira","Rossi","Bianchi","Ferrari","Romano","Dubois","Moreau","Laurent","Weber","Schmidt","Müller","Kowalski","Novak","Carter","Brooks","Hayes","Coleman","Reed","Foster","Grant","Mensah","Okafor","Diallo","Traoré","Ndiaye","Keita","Kipchoge","Rotich","Cheruiyot","Waweru","Mwangi","Bekele","Gebrselassie","Tola","Cheptegei","Kiplimo","Bolt","Fraser","Smith","Williams","Johnson","Brown","Jones","Miller","Davis","Wilson","Anderson","Taylor","Thomas","Moore","Martin","Jackson","White","Harris","Thompson","González","Rodríguez","Pérez","Gómez","Díaz","Álvarez","Castro","Vargas","Rojas","Campos","Herrera","Peña","Aguirre","Medina","Sosa","Peralta","Duarte","Ibarra","Quintero","Salazar","Valdez","Brito","Cabrera","Nakamura","Sato","Kim","Park","Chen","Liu","Yang","Sharma","Patel","Singh","Kaur","Haddad","Benali","El Amrani","Almeida","Sousa","Nunes","Pinto","Carvalho"];

export const CITIES = ["Madrid","Barcelona","Valencia","Sevilla","París","Lyon","Berlín","Múnich","Londres","Manchester","Roma","Milán","Ámsterdam","Oslo","Estocolmo","Zúrich","Bruselas","Lisboa","Oporto","Praga","Varsovia","Budapest","Atenas","Estambul","Rabat","Casablanca","Nairobi","Addis Abeba","Kampala","Johannesburgo","Lagos","Accra","São Paulo","Río","Buenos Aires","CDMX","Bogotá","La Habana","Kingston","Toronto","Sídney","Melbourne","Tokio","Osaka","Pekín","Shanghái","Seúl","Nueva Delhi","Doha","Managua","Santo Domingo","Miami","Nueva York","Eugene","Los Ángeles"];

export const TRAINING: any = {
  velocidad: { n: "Velocidad", sessions: [
    { id: "acc60", n: "Aceleraciones", fx: { acc: 1.0, pow: 0.45, spd: 0.25 }, fat: 12, desc: "6×30 m desde parado" },
    { id: "6x60",  n: "6×60 m", fx: { spd: 0.55, acc: 0.35 }, fat: 16, desc: "Series de velocidad" },
    { id: "4x100", n: "4×100 m", fx: { spd: 0.65, ana: 0.25 }, fat: 18, desc: "Velocidad resistencia corta" },
    { id: "maxsp", n: "Sprints máximos", fx: { spd: 0.8, pow: 0.35 }, fat: 20, form: 1, desc: "3×80 m al 100%" },
  ]},
  resistencia: { n: "Resistencia", sessions: [
    { id: "5x400", n: "5×400 m", fx: { ana: 0.65, aer: 0.3 }, fat: 20, desc: "Intervalos lácticos" },
    { id: "4x800", n: "4×800 m", fx: { aer: 0.6, ana: 0.35 }, fat: 22, desc: "Intervalos largos" },
    { id: "rodaje",n: "Rodaje", fx: { aer: 0.55, eco: 0.3 }, fat: 12, desc: "45 min suave" },
    { id: "intv",  n: "Intervalos", fx: { ana: 0.45, aer: 0.4, rec: 0.12 }, fat: 18, desc: "12×200 m" },
  ]},
  fuerza: { n: "Fuerza", sessions: [
    { id: "fuerza", n: "Fuerza", fx: { str: 0.7, pow: 0.25 }, fat: 14, desc: "Sentadilla, peso muerto" },
    { id: "explo",  n: "Fuerza explosiva", fx: { pow: 0.65, str: 0.25, acc: 0.15 }, fat: 16, desc: "Cargadas y arrancadas" },
  ]},
  potencia: { n: "Potencia", sessions: [
    { id: "plio",  n: "Pliometría", fx: { pow: 0.55, acc: 0.25 }, fat: 14, desc: "Saltos y rebotes" },
    { id: "saltos",n: "Saltos", fx: { pow: 0.45, kck: 0.25 }, fat: 12, desc: "Multisaltos" },
  ]},
  tecnica: { n: "Técnica", sessions: [
    { id: "tcarr", n: "Técnica de carrera", fx: { tec: 0.5, eco: 0.25, stt: 0.12 }, fat: 6, desc: "Drills y skipping" },
    { id: "tval",  n: "Técnica de vallas", fx: { tec: 0.8 }, fat: 8, desc: "Pasos entre vallas" },
    { id: "salid", n: "Salidas", fx: { stt: 0.65, acc: 0.25 }, fat: 8, desc: "Salidas de tacos" },
  ]},
  recuperacion: { n: "Recuperación", sessions: [
    { id: "desc",  n: "Descanso total", fx: {}, fat: -26, form: 1.5, desc: "Dormir y desconectar" },
    { id: "regen", n: "Recuperación ligera", fx: { aer: 0.12 }, fat: -16, form: 1, desc: "Bici suave + estiramientos" },
    { id: "fisio", n: "Fisioterapia", fx: {}, fat: -20, form: 1, heal: 1, cost: 80, desc: "Masaje deportivo (80 €)" },
  ]},
};

export const ACHIEVEMENTS = [
  { id: "first_win",  n: "Primera victoria", d: "Gana tu primera carrera" },
  { id: "first_pb",   n: "Primer PB", d: "Consigue tu primer récord personal" },
  { id: "first_medal",n: "Primera medalla", d: "Sube a un podio" },
  { id: "nat_champ",  n: "Campeón nacional", d: "Gana el Campeonato Nacional" },
  { id: "first_record",n:"Primer récord", d: "Bate un récord nacional, del campeonato o mundial" },
  { id: "barrier",    n: "Barrera mítica", d: "100 < 10.00 · 400 < 44.5 · 800 < 1:44 · 1500 < 3:30" },
  { id: "top100",     n: "Top 100 mundial", d: "Entra en el ranking mundial" },
  { id: "top10",      n: "Top 10 mundial", d: "Entre los 10 mejores del mundo" },
  { id: "world_champ",n: "Campeón mundial", d: "Gana el Campeonato Mundial" },
  { id: "olympic",    n: "Campeón olímpico", d: "Gana los Juegos Olímpicos" },
  { id: "legend",     n: "Leyenda", d: "Legend Score ≥ 90 al retirarte" },
  { id: "relay_gold", n: "Oro en relevos", d: "Gana un título internacional de relevos" },
];

export const MONTHS = ["MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT"];
export const TIERS = [null,
  { n: "Local", pts: 5, color: "t1" },
  { n: "Regional", pts: 10, color: "t2" },
  { n: "Nacional", pts: 20, color: "t3" },
  { n: "Internacional", pts: 35, color: "t4" },
  { n: "Gran Campeonato", pts: 60, color: "t5" },
];
export const PRIZES = [null,
  [150, 80, 40, 20, 0, 0, 0, 0],
  [600, 300, 150, 80, 40, 25, 15, 10],
  [2200, 1100, 600, 350, 220, 140, 90, 60],
  [9000, 4500, 2600, 1600, 1100, 750, 550, 350],
  [60000, 30000, 18000, 12000, 8000, 6000, 4000, 3000],
];
export const CLUBS = [
  { name: "Club Atletismo Local", level: 1, bonus: 0 },
  { name: "Atletismo Madrid", level: 2, bonus: 0.08 },
  { name: "Elite Track Academy", level: 3, bonus: 0.15 },
];
export const SPONSORS = [
  { name: "RunFast Wear", fame: 25, week: 120 },
  { name: "Volt Energy", fame: 70, week: 350 },
  { name: "AeroSpikes Pro", fame: 150, week: 900 },
  { name: "Global Sports", fame: 280, week: 2400 },
];
export const SKINS = ["#F2C9A0","#E0AC7E","#C6885C","#A96B45","#8C5433","#6B3E23","#503018"];
export const HAIRS = ["#1C1B1A","#3B2A1A","#5C3A1E","#8A5A2B","#B98A44","#111111","#7A1F1F","#274156","#E8E8E8"];
export const JERSEYS = ["#FF5A2B","#FFC531","#3DDC97","#4CC3FF","#FF4D5E","#B07CFF","#FF8A00","#2BD9C7","#F2F2F2","#7FFF6B","#FF6BB5","#5B8CFF"];

export const INJURIES = [
  { id: "molestias", n: "Molestias", days: 2, pen: 3 },
  { id: "sobrecarga", n: "Sobrecarga", days: 4, pen: 6 },
  { id: "leve", n: "Lesión leve", days: 7, pen: 10 },
  { id: "moderada", n: "Lesión moderada", days: 14, pen: 18 },
];
