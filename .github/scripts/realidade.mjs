// Calendário de contribuições "a realidade mudando" (arte original, tema magia do caos).
// Lê as contribuições reais do último ano (GraphQL do GitHub) e gera um SVG animado:
//   1. raios de energia saem do dia de hoje até os dias com mais commits;
//   2. uma onda de choque escarlate atravessa a grade: cada célula gira, brilha e muda de cor;
//   3. a realidade reescrita mostra a palavra CAOS no meio da grade;
//   4. uma segunda onda devolve tudo ao normal. O ciclo se repete.
// Uso: node realidade.mjs PASTA_DE_SAIDA [--exemplo]    (GITHUB_TOKEN e GITHUB_REPOSITORY_OWNER no ambiente)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [saida = 'dist', ...opcoes] = process.argv.slice(2);
const exemplo = opcoes.includes('--exemplo');
const login = process.env.GITHUB_REPOSITORY_OWNER || 'paulomarcelli';

async function lerContribuicoes() {
  if (exemplo) {
    // dados inventados (só para ver a arte sem rede)
    const semanas = [];
    let s = 7;
    for (let w = 0; w < 53; w++) {
      const dias = [];
      for (let d = 0; d < (w === 52 ? 4 : 7); d++) {
        s = (s * 16807) % 2147483647;
        const n = (s % 100) < 45 ? 0 : (s % 13);
        dias.push({ contributionCount: n, contributionLevel: ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'][Math.min(4, Math.ceil(n / 3))], weekday: d });
      }
      semanas.push({ contributionDays: dias });
    }
    return { total: 1234, semanas };
  }
  const consulta = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount contributionLevel weekday date}}}}}}`;
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'realidade-svg' },
    body: JSON.stringify({ query: consulta, variables: { login } }),
  });
  const j = await r.json();
  if (!j.data?.user) throw new Error('GraphQL falhou: ' + JSON.stringify(j.errors ?? j));
  const cal = j.data.user.contributionsCollection.contributionCalendar;
  return { total: cal.totalContributions, semanas: cal.weeks };
}

// letras 5x7 da palavra que aparece na realidade reescrita
const FONTE = {
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
};
const PALAVRA = 'CAOS';
const NIVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const TEMAS = {
  escuro: { flash: "#ff9aac", fundo: "#0a0204", borda: '#ff1f3d', texto: '#f6d6dc', sub: '#ff4d6d', niveis: ['#1d0a10', '#4d0a18', '#8f0f27', '#d11a3a', '#ff3355'], brilho: '#ff1f3d', letra: '#ff7a90' },
  claro: { flash: "#ff4d6d", fundo: "#fff5f6", borda: '#c8102e', texto: '#4a0612', sub: '#c8102e', niveis: ['#f1dde1', '#f5a3b1', '#e8566f', '#c8102e', '#7a0a1c'], brilho: '#c8102e', letra: '#7a0a1c' },
};

function svg({ total, semanas }, t) {
  const P = 16, C = 12, X0 = 44, Y0 = 58, CICLO = 14;
  const nS = semanas.length, W = X0 + nS * P + 24, H = Y0 + 7 * P + 46;
  const celulas = [];
  semanas.forEach((s, w) => s.contributionDays.forEach((d) => celulas.push({ w, d: d.weekday, n: NIVEL[d.contributionLevel] ?? 0, cont: d.contributionCount })));
  const ultima = celulas[celulas.length - 1];
  const ox = X0 + ultima.w * P + C / 2, oy = Y0 + ultima.d * P + C / 2;
  // a palavra centralizada na grade
  const largPal = PALAVRA.length * 6 - 1, col0 = Math.floor((nS - largPal) / 2);
  const naPalavra = (w, d) => {
    const c = w - col0; if (c < 0 || c >= largPal || c % 6 === 5) return false;
    return FONTE[PALAVRA[Math.floor(c / 6)]][d][c % 6] === '#';
  };
  let semente = 99;
  const acaso = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
  const maxDist = Math.hypot(nS * P, 7 * P);
  let rects = '';
  for (const c of celulas) {
    const x = X0 + c.w * P, y = Y0 + c.d * P;
    const dist = Math.hypot(x + C / 2 - ox, y + C / 2 - oy);
    const atraso = (dist / maxDist) * 3.2;
    const reescrito = naPalavra(c.w, c.d) ? 4 : (acaso() < 0.12 ? 1 + Math.floor(acaso() * 2) : 0);
    rects += `<g class="c" style="transform-origin:${x + C / 2}px ${y + C / 2}px;animation-delay:${atraso.toFixed(2)}s">`
      + `<rect x="${x}" y="${y}" width="${C}" height="${C}" rx="2.5" fill="${t.niveis[c.n]}"><title>${c.cont} contribuições</title></rect>`
      + `<rect class="r" x="${x}" y="${y}" width="${C}" height="${C}" rx="2.5" fill="${reescrito === 4 ? t.letra : t.niveis[reescrito]}" style="animation-delay:${atraso.toFixed(2)}s"/>`
      + `<rect class="f" x="${x - 1}" y="${y - 1}" width="${C + 2}" height="${C + 2}" rx="3" fill="${t.flash}" style="animation-delay:${atraso.toFixed(2)}s"/>`
      + `</g>`;
  }
  // raios até os dias mais fortes
  const fortes = celulas.filter((c) => c.n >= 3).sort((a, b) => b.cont - a.cont).slice(0, 7);
  let raios = '';
  fortes.forEach((c, i) => {
    const x = X0 + c.w * P + C / 2, y = Y0 + c.d * P + C / 2;
    let d = `M${ox},${oy}`;
    const passos = 7;
    for (let k = 1; k <= passos; k++) {
      const f = k / passos, jx = k < passos ? (acaso() - 0.5) * 18 : 0, jy = k < passos ? (acaso() - 0.5) * 18 : 0;
      d += ` L${(ox + (x - ox) * f + jx).toFixed(1)},${(oy + (y - oy) * f + jy).toFixed(1)}`;
    }
    raios += `<path class="raio" d="${d}" style="animation-delay:${(i * 0.08).toFixed(2)}s"/>`;
  });
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  let rotMes = '';
  let mesAntes = -1;
  semanas.forEach((s, w) => {
    const dt = s.contributionDays[0]?.date; if (!dt) return;
    const m = +dt.slice(5, 7) - 1;
    if (m !== mesAntes && w < nS - 2) { rotMes += `<text x="${X0 + w * P}" y="${Y0 - 8}" class="m">${meses[m]}</text>`; mesAntes = m; }
  });
  const pct = (s) => `${((s / CICLO) * 100).toFixed(2)}%`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${total} contribuições no último ano">
<style>
text{font-family:Georgia,'Times New Roman',serif}
.m{font-size:10px;fill:${t.texto};opacity:.7}
.c{animation:gira ${CICLO}s ease-in-out infinite}
@keyframes gira{0%,${pct(2.2)}{transform:none}${pct(2.6)}{transform:rotate(45deg) scale(1.55)}${pct(3.2)}{transform:rotate(90deg) scale(1)}${pct(8.4)}{transform:rotate(90deg)}${pct(8.8)}{transform:rotate(135deg) scale(1.4)}${pct(9.4)},100%{transform:rotate(180deg) scale(1)}}
.r{opacity:0;animation:muda ${CICLO}s linear infinite}
@keyframes muda{0%,${pct(2.6)}{opacity:0}${pct(2.9)},${pct(8.6)}{opacity:1}${pct(9)},100%{opacity:0}}
.f{opacity:0;animation:flash ${CICLO}s linear infinite}
@keyframes flash{0%,${pct(2.3)}{opacity:0}${pct(2.6)}{opacity:.85}${pct(3)},${pct(8.5)}{opacity:0}${pct(8.8)}{opacity:.6}${pct(9.2)},100%{opacity:0}}
.raio{fill:none;stroke:${t.brilho};stroke-width:1.6;stroke-linejoin:round;stroke-dasharray:900;stroke-dashoffset:900;filter:url(#b);animation:raio ${CICLO}s linear infinite}
@keyframes raio{0%,${pct(1)}{stroke-dashoffset:900;opacity:1}${pct(2.1)}{stroke-dashoffset:0;opacity:1}${pct(2.8)},100%{stroke-dashoffset:0;opacity:0}}
.onda{fill:none;stroke:${t.brilho};stroke-width:3;opacity:0;animation:onda ${CICLO}s ease-out infinite}
@keyframes onda{0%,${pct(2.2)}{r:0;opacity:0}${pct(2.3)}{r:4;opacity:.9}${pct(5.6)}{r:${maxDist.toFixed(0)};opacity:0}${pct(8.3)}{r:0;opacity:0}${pct(8.4)}{r:4;opacity:.7}${pct(11.6)},100%{r:${maxDist.toFixed(0)};opacity:0}}
.sig{transform-origin:${ox}px ${oy}px;animation:sig ${CICLO}s ease-in-out infinite;opacity:0}
@keyframes sig{0%,${pct(0.4)}{opacity:0;transform:scale(.2) rotate(0)}${pct(1.6)}{opacity:1;transform:scale(1) rotate(120deg)}${pct(2.6)}{opacity:0;transform:scale(2.4) rotate(240deg)}100%{opacity:0}}
.leg{animation:leg ${CICLO}s linear infinite}
@keyframes leg{0%,${pct(3.4)}{opacity:0}${pct(4)},${pct(8.2)}{opacity:1}${pct(8.6)},100%{opacity:0}}
.leg0{animation:leg0 ${CICLO}s linear infinite}
@keyframes leg0{0%,${pct(2.6)}{opacity:1}${pct(3)},${pct(9)}{opacity:0}${pct(9.6)},100%{opacity:1}}
</style>
<defs><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="grade"><rect x="${X0 - 6}" y="${Y0 - 6}" width="${nS * P + 8}" height="${7 * P + 8}"/></clipPath></defs>
<rect width="${W}" height="${H}" rx="12" fill="${t.fundo}"/>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="11" fill="none" stroke="${t.borda}" stroke-opacity=".35"/>
<text x="${X0}" y="26" font-size="16" font-weight="700" fill="${t.sub}" letter-spacing="1.5">A realidade, reescrita a cada commit</text>
<text x="${W - 24}" y="26" font-size="13" fill="${t.texto}" text-anchor="end">${total} contribuições no último ano</text>
${rotMes}
<text x="${X0 - 10}" y="${Y0 + P + 10}" class="m" text-anchor="end">seg</text><text x="${X0 - 10}" y="${Y0 + 3 * P + 10}" class="m" text-anchor="end">qua</text><text x="${X0 - 10}" y="${Y0 + 5 * P + 10}" class="m" text-anchor="end">sex</text>
${rects}
<g clip-path="url(#grade)"><circle class="onda" cx="${ox}" cy="${oy}" r="0"/></g>
${raios}
<g class="sig" stroke="${t.brilho}" fill="none" stroke-width="1.4"><circle cx="${ox}" cy="${oy}" r="22"/><circle cx="${ox}" cy="${oy}" r="16" stroke-dasharray="2 4"/><polygon points="${[0, 1, 2, 3, 4, 5, 6].map((j) => { const a = (j * 3 * 2 * Math.PI) / 7 - Math.PI / 2; return `${(ox + Math.cos(a) * 14).toFixed(1)},${(oy + Math.sin(a) * 14).toFixed(1)}`; }).join(' ')}"/></g>
<text class="leg0" x="${X0}" y="${H - 16}" font-size="12" fill="${t.texto}" opacity=".8">hoje é a origem do feitiço ⟶ a onda percorre o ano inteiro</text>
<text class="leg" x="${X0}" y="${H - 16}" font-size="12" font-style="italic" fill="${t.sub}">a realidade foi reescrita… e já está voltando ao normal</text>
</svg>`;
}

const dados = await lerContribuicoes();
mkdirSync(saida, { recursive: true });
writeFileSync(join(saida, 'realidade-escura.svg'), svg(dados, TEMAS.escuro));
writeFileSync(join(saida, 'realidade-clara.svg'), svg(dados, TEMAS.claro));
console.log(`gerado: ${dados.total} contribuições, ${dados.semanas.length} semanas`);
