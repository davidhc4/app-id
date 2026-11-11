'use strict';

/* ============================================================
   Placas — registro local de placas de carros
   Los datos viven en el dispositivo como texto CSV.
   ============================================================ */

const CLAVE_CSV = 'placas.csv';
const CLAVE_TEMA = 'placas.tema';
const CABECERA = 'placa,fecha,hora,iso';
/** Puente con la parte nativa de Android (no existe al abrir la interfaz en un navegador). */
const NATIVO = typeof Android !== 'undefined';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** Registros en memoria: { p: placa, t: milisegundos }, ordenados por fecha ascendente. */
let registros = [];

/* ---------------- Fechas ---------------- */

const p2 = n => String(n).padStart(2, '0');
const claveDia = t => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const horaTxt = t => { const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
const isoLocal = t => {
  const d = new Date(t), o = -d.getTimezoneOffset(), s = o >= 0 ? '+' : '-';
  return `${claveDia(t)}T${horaTxt(t)}${s}${p2(Math.floor(Math.abs(o) / 60))}:${p2(Math.abs(o) % 60)}`;
};
const fFecha = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fHora = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' });
const fechaTxt = t => fFecha.format(t);
const fechaHoraTxt = t => `${fFecha.format(t)}, ${fHora.format(t)}`;
const inicioDia = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const sumaDias = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };

function duracion(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}
function tituloDia(clave) {
  const hoy = inicioDia(Date.now());
  if (clave === claveDia(hoy)) return 'Hoy';
  if (clave === claveDia(sumaDias(hoy, -1))) return 'Ayer';
  const [a, m, d] = clave.split('-').map(Number);
  return fechaTxt(new Date(a, m - 1, d));
}

/* ---------------- CSV ---------------- */

const normalizar = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

function aCSV(lista) {
  return CABECERA + '\n' + lista.map(r => `${r.p},${claveDia(r.t)},${horaTxt(r.t)},${isoLocal(r.t)}`).join('\n') + (lista.length ? '\n' : '');
}

function partirLinea(linea, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (q) { if (c === '"') { if (linea[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function leerFecha(fecha, hora) {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(fecha || '');
  let a, me, d;
  if (m) [a, me, d] = [+m[1], +m[2], +m[3]];
  else if ((m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/.exec(fecha || ''))) [d, me, a] = [+m[1], +m[2], +m[3]];
  else return NaN;
  const h = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(hora || '') || [0, 0, 0, 0];
  return new Date(a, me - 1, d, +h[1], +h[2], +(h[3] || 0)).getTime();
}

/** Convierte texto CSV en registros. Acepta separador coma o punto y coma, con o sin cabecera. */
function deCSV(texto) {
  const lineas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lineas.length) return [];
  const sep = (lineas[0].split(';').length > lineas[0].split(',').length) ? ';' : ',';
  let col = { placa: 0, fecha: 1, hora: 2, iso: 3 };
  const cab = partirLinea(lineas[0], sep).map(s => s.toLowerCase());
  if (cab.includes('placa')) {
    col = { placa: cab.indexOf('placa'), fecha: cab.indexOf('fecha'), hora: cab.indexOf('hora'), iso: cab.indexOf('iso') };
    lineas.shift();
  }
  const out = [];
  for (const l of lineas) {
    const c = partirLinea(l, sep);
    const p = normalizar(c[col.placa]);
    if (!p) continue;
    let t = col.iso >= 0 && c[col.iso] ? Date.parse(c[col.iso]) : NaN;
    if (isNaN(t)) t = leerFecha(c[col.fecha], c[col.hora]);
    if (isNaN(t)) t = Date.now();
    out.push({ p, t });
  }
  return out.sort((a, b) => a.t - b.t);
}

function guardar() {
  let ok = true;
  try {
    if (NATIVO) ok = Android.guardar(aCSV(registros));
    else localStorage.setItem(CLAVE_CSV, aCSV(registros));
  } catch (e) { ok = false; }
  if (!ok) toast('No se pudo guardar el archivo CSV');
}
function cargar() {
  try { registros = deCSV(NATIVO ? Android.leer() : localStorage.getItem(CLAVE_CSV)); } catch (e) { registros = []; }
}

/* ---------------- Estadísticas ---------------- */

/** Agrupa los avistamientos por placa: Map<placa, number[]> (tiempos ascendentes). */
function porPlaca(lista = registros) {
  const m = new Map();
  for (const r of lista) { if (!m.has(r.p)) m.set(r.p, []); m.get(r.p).push(r.t); }
  return m;
}

/** Resumen de una placa: veces, primera, última, intervalos entre avistamientos. */
function resumenPlaca(placa, lista = registros) {
  const ts = lista.filter(r => r.p === placa).map(r => r.t);
  const saltos = ts.slice(1).map((t, i) => t - ts[i]);
  return {
    placa, veces: ts.length, tiempos: ts, primera: ts[0], ultima: ts[ts.length - 1], saltos,
    diasDistintos: new Set(ts.map(claveDia)).size,
    saltoMedio: saltos.length ? saltos.reduce((a, b) => a + b, 0) / saltos.length : 0,
    saltoMin: saltos.length ? Math.min(...saltos) : 0,
    saltoMax: saltos.length ? Math.max(...saltos) : 0,
  };
}

/** Rachas de días consecutivos con al menos un registro. */
function rachas(dias) {
  const set = new Set(dias);
  let mejor = 0;
  for (const d of set) {
    const [a, m, dd] = d.split('-').map(Number);
    const t = new Date(a, m - 1, dd).getTime();
    if (set.has(claveDia(sumaDias(t, -1)))) continue; // no es inicio de racha
    let n = 1, c = t;
    while (set.has(claveDia(c = sumaDias(c, 1)))) n++;
    mejor = Math.max(mejor, n);
  }
  const hoy = inicioDia(Date.now());
  let c = set.has(claveDia(hoy)) ? hoy : sumaDias(hoy, -1), actual = 0;
  while (set.has(claveDia(c))) { actual++; c = sumaDias(c, -1); }
  return { actual, mejor };
}

/** Estadísticas generales de todos los registros. */
function estadisticas(lista = registros) {
  const ahora = Date.now(), hoy = inicioDia(ahora);
  const grupos = porPlaca(lista);
  const dias = new Map();
  const semana = Array(7).fill(0), horas = Array(24).fill(0);
  for (const r of lista) {
    const k = claveDia(r.t), d = new Date(r.t);
    dias.set(k, (dias.get(k) || 0) + 1);
    semana[(d.getDay() + 6) % 7]++; // lunes = 0
    horas[d.getHours()]++;
  }
  const lunes = sumaDias(hoy, -((new Date(hoy).getDay() + 6) % 7));
  const mes = new Date(hoy); mes.setDate(1);
  const desde = t0 => lista.filter(r => r.t >= t0).length;
  const repetidas = [...grupos].filter(([, ts]) => ts.length > 1);
  let diaTop = null;
  for (const [k, n] of dias) if (!diaTop || n > diaTop.n) diaTop = { dia: k, n };
  const ultimos = [];
  for (let i = 13; i >= 0; i--) { const t = sumaDias(hoy, -i); ultimos.push({ t, n: dias.get(claveDia(t)) || 0 }); }
  // Coincidencias: cada registro que repite una placa ya vista
  const vistos = new Map(), coincidencias = [];
  for (const r of lista) {
    const n = (vistos.get(r.p) || { n: 0 }).n;
    if (n) coincidencias.push({ p: r.p, t: r.t, vez: n + 1, anterior: vistos.get(r.p).t });
    vistos.set(r.p, { n: n + 1, t: r.t });
  }
  return {
    total: lista.length, unicas: grupos.size, repetidas: repetidas.length,
    reavistamientos: lista.length - grupos.size,
    hoy: desde(hoy), semana: desde(lunes), mes: desde(mes.getTime()),
    diasActivos: dias.size, promedioDia: dias.size ? lista.length / dias.size : 0,
    diaTop, rachas: rachas(dias.keys()),
    primera: lista[0]?.t, ultima: lista[lista.length - 1]?.t,
    porSemana: semana, porHora: horas, ultimos14: ultimos,
    top: repetidas.map(([p, ts]) => ({ p, n: ts.length, ultima: ts[ts.length - 1] })).sort((a, b) => b.n - a.n || b.ultima - a.ultima).slice(0, 8),
    coincidencias: coincidencias.reverse().slice(0, 8),
  };
}

/* ---------------- Utilidades de interfaz ---------------- */

let toastTimer;
function toast(msg, accion, fn) {
  const el = $('#toast');
  el.textContent = msg;
  if (accion) { const b = document.createElement('button'); b.textContent = accion; b.onclick = () => { el.classList.remove('ver'); fn(); }; el.append(b); }
  el.classList.add('ver');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('ver'), accion ? 5000 : 2600);
}
const vibrar = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

function contar(el, hasta, dec = 0) {
  const fmt = v => dec ? v.toFixed(dec).replace('.', ',') : Math.round(v).toLocaleString('es');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !hasta) { el.textContent = fmt(hasta); return; }
  const t0 = performance.now(), dur = 650;
  const paso = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(hasta * e);
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

const ICONO_BORRAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/></svg>';

function filaHTML(r, i, conteos, borrable = true) {
  const n = conteos.get(r.p)?.length || 1;
  return `<li class="item" style="--i:${Math.min(i, 12)}" data-p="${r.p}" data-t="${r.t}">
    <button class="abre" aria-label="Ver detalle de ${r.p}">
      <span class="placa">${r.p}</span>
      <span class="cuando"><b>${fHora.format(r.t)}</b>${fechaTxt(r.t)}</span>
      ${n > 1 ? `<span class="veces">×${n}</span>` : ''}
    </button>
    ${borrable ? `<button class="borrar" aria-label="Borrar este registro de ${r.p}">${ICONO_BORRAR}</button>` : ''}
  </li>`;
}

/* ---------------- Vista: Anotar ---------------- */

function pintarRecientes() {
  const ul = $('#recientes'), g = porPlaca();
  const ult = registros.slice(-5).reverse();
  ul.innerHTML = ult.length ? ult.map((r, i) => filaHTML(r, i, g)).join('')
    : '<li class="vacio">Aún no has anotado ninguna placa.<br>Escribe la primera arriba.</li>';
}

function pintarPista() {
  const p = normalizar($('#inPlaca').value), el = $('#pista');
  const n = p ? registros.filter(r => r.p === p).length : 0;
  el.classList.toggle('vista', n > 0);
  el.textContent = n ? `Ya la has visto ${n} ${n === 1 ? 'vez' : 'veces'}. Guárdala para registrar la coincidencia.` : '';
}

function agregar(ev) {
  ev.preventDefault();
  const inp = $('#inPlaca'), p = normalizar(inp.value);
  if (p.length < 3) {
    const caja = inp.parentElement;
    caja.classList.remove('sacude'); void caja.offsetWidth; caja.classList.add('sacude');
    $('#pista').textContent = 'Escribe al menos 3 letras o números.';
    vibrar(60); inp.focus(); return;
  }
  const antes = resumenPlaca(p);
  const t = Date.now();
  registros.push({ p, t });
  guardar();
  inp.value = ''; pintarPista();

  const res = $('#resultado');
  if (antes.veces) {
    vibrar([40, 60, 40]);
    res.innerHTML = `<div class="aviso repetida">
      <strong>¡Coincidencia! Es la ${antes.veces + 1}.ª vez que ves ${p}</strong>
      <dl>
        <dt>Ahora</dt><dd>${fechaHoraTxt(t)}</dd>
        <dt>Última vez</dt><dd>${fechaHoraTxt(antes.ultima)} (hace ${duracion(t - antes.ultima)})</dd>
        <dt>Primera vez</dt><dd>${fechaHoraTxt(antes.primera)}</dd>
      </dl>
      <button data-detalle="${p}">Ver todas las fechas</button>
    </div>`;
  } else {
    vibrar(30);
    res.innerHTML = `<div class="aviso nueva"><strong>Placa nueva: ${p}</strong>Guardada el ${fechaHoraTxt(t)}</div>`;
  }
  pintarRecientes();
  inp.focus();
}

/* ---------------- Vista: Historial ---------------- */

let filtro = 'todas', limite = 150;

function pintarHistorial() {
  const q = normalizar($('#inBuscar').value), g = porPlaca();
  let lista = registros.filter(r => (!q || r.p.includes(q)) && (filtro === 'todas' || g.get(r.p).length > 1));
  const total = lista.length;
  lista = lista.slice(-limite).reverse();
  const cont = $('#historial');
  if (!total) {
    cont.innerHTML = `<p class="vacio">${registros.length ? 'Ninguna placa coincide con la búsqueda.' : 'Tu historial está vacío.'}</p>`;
    return;
  }
  let html = '', dia = '', i = 0;
  for (const r of lista) {
    const k = claveDia(r.t);
    if (k !== dia) { if (dia) html += '</ul>'; dia = k; html += `<h2 class="sub">${tituloDia(k)}</h2><ul class="lista">`; }
    html += filaHTML(r, i++, g);
  }
  html += '</ul>';
  if (total > limite) html += `<button class="btn mas" id="btnMas">Mostrar más (${total - limite} restantes)</button>`;
  cont.innerHTML = html;
}

function borrarRegistro(li) {
  const p = li.dataset.p, t = +li.dataset.t;
  const idx = registros.findIndex(r => r.p === p && r.t === t);
  if (idx < 0) return;
  const [quitado] = registros.splice(idx, 1);
  guardar();
  li.classList.add('sale');
  setTimeout(refrescar, 240);
  toast(`Registro de ${p} borrado`, 'Deshacer', () => {
    registros.push(quitado); registros.sort((a, b) => a.t - b.t); guardar(); refrescar();
  });
}

/* ---------------- Vista: Estadísticas ---------------- */

function barrasHTML(valores, etiquetas, mostrarValor) {
  const max = Math.max(1, ...valores);
  return `<div class="barras">${valores.map((v, i) =>
    `<div class="barra${v ? '' : ' cero'}${v === max && v ? ' max' : ''}" style="--i:${i}" title="${etiquetas[i]}: ${v}">
      ${mostrarValor ? `<em>${v || ''}</em>` : ''}<i data-h="${(v / max) * 100}"></i><small>${etiquetas[i]}</small></div>`).join('')}</div>`;
}

function pintarStats() {
  const cont = $('#stats');
  if (!registros.length) { cont.innerHTML = '<p class="vacio">Anota algunas placas para ver tus estadísticas.</p>'; return; }
  const s = estadisticas(), g = porPlaca();
  const kpis = [
    [s.total, 'Registros en total'], [s.unicas, 'Placas distintas'],
    [s.repetidas, 'Placas vistas más de una vez'], [s.reavistamientos, 'Coincidencias (reavistamientos)'],
    [s.hoy, 'Hoy'], [s.semana, 'Esta semana'], [s.mes, 'Este mes'], [s.promedioDia, 'Promedio por día activo', 1],
  ];
  const [a, m, d] = s.diaTop.dia.split('-').map(Number);
  const horaTop = s.porHora.indexOf(Math.max(...s.porHora));
  const dSem = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const nomSem = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const semTop = s.porSemana.indexOf(Math.max(...s.porSemana));

  cont.innerHTML = `
    <div class="kpis">${kpis.map(([v, t, dec], i) => `<div class="kpi" style="--i:${i}"><b data-n="${v}" data-dec="${dec || 0}">0</b><span>${t}</span></div>`).join('')}</div>

    <div class="card"><h2>Últimos 14 días</h2>
      ${barrasHTML(s.ultimos14.map(x => x.n), s.ultimos14.map(x => new Date(x.t).getDate()), true)}</div>

    <div class="card"><h2>Fechas</h2><dl class="datos">
      <dt>Primer registro</dt><dd>${fechaTxt(s.primera)}</dd>
      <dt>Último registro</dt><dd>${fechaHoraTxt(s.ultima)}</dd>
      <dt>Días con registros</dt><dd>${s.diasActivos}</dd>
      <dt>Día con más placas</dt><dd>${fechaTxt(new Date(a, m - 1, d))} (${s.diaTop.n})</dd>
      <dt>Racha actual</dt><dd>${s.rachas.actual} ${s.rachas.actual === 1 ? 'día' : 'días'}</dd>
      <dt>Mejor racha</dt><dd>${s.rachas.mejor} ${s.rachas.mejor === 1 ? 'día' : 'días'}</dd>
    </dl></div>

    <div class="card"><h2>Por día de la semana</h2><p class="muted">Anotas más los ${nomSem[semTop]}.</p>
      ${barrasHTML(s.porSemana, dSem, true)}</div>

    <div class="card"><h2>Por hora del día</h2><p class="muted">Tu hora más activa: ${horaTop}:00 – ${horaTop + 1}:00.</p>
      ${barrasHTML(s.porHora, s.porHora.map((_, h) => h % 6 === 0 ? h + 'h' : ' '), false)}</div>

    <div class="card"><h2>Placas más repetidas</h2>
      ${s.top.length ? `<ul class="lista">${s.top.map((x, i) => filaHTML({ p: x.p, t: x.ultima }, i, g, false)).join('')}</ul>`
        : '<p class="muted">Todavía no has vuelto a ver ninguna placa.</p>'}</div>

    <div class="card"><h2>Coincidencias recientes</h2>
      ${s.coincidencias.length ? `<ul class="lista">${s.coincidencias.map((c, i) => `<li class="item" style="--i:${i}" data-p="${c.p}">
          <button class="abre"><span class="placa">${c.p}</span>
          <span class="cuando"><b>${c.vez}.ª vez · ${fechaHoraTxt(c.t)}</b>${duracion(c.t - c.anterior)} después de la anterior</span></button></li>`).join('')}</ul>`
        : '<p class="muted">Cuando anotes una placa que ya habías visto, aparecerá aquí.</p>'}</div>`;

  $$('[data-n]', cont).forEach(el => contar(el, +el.dataset.n, +el.dataset.dec));
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.barra i', cont).forEach(el => { el.style.height = el.dataset.h + '%'; })));
}

/* ---------------- Detalle de placa ---------------- */

function abrirDetalle(placa) {
  const r = resumenPlaca(placa);
  if (!r.veces) return;
  const lineas = r.tiempos.map((t, i) => ({ t, i })).reverse();
  $('#hojaCuerpo').innerHTML = `
    <div class="hoja-cab"><span class="placa grande" id="hojaPlaca">${placa}</span>
      <p>Vista <b>${r.veces}</b> ${r.veces === 1 ? 'vez' : 'veces'}<br>en ${r.diasDistintos} ${r.diasDistintos === 1 ? 'día' : 'días distintos'}</p></div>
    <dl class="datos">
      <dt>Primera vez</dt><dd>${fechaHoraTxt(r.primera)}</dd>
      <dt>Última vez</dt><dd>${fechaHoraTxt(r.ultima)}</dd>
      <dt>Hace</dt><dd>${duracion(Date.now() - r.ultima)}</dd>
      ${r.saltos.length ? `<dt>Tiempo medio entre avistamientos</dt><dd>${duracion(r.saltoMedio)}</dd>
      <dt>Intervalo más corto / más largo</dt><dd>${duracion(r.saltoMin)} / ${duracion(r.saltoMax)}</dd>` : ''}
    </dl>
    <h2 class="sub">Todas las fechas</h2>
    <ol class="linea">${lineas.map(({ t, i }, k) => `<li style="--i:${Math.min(k, 12)}"><b>${fechaHoraTxt(t)}</b>
      <span>${i === 0 ? 'Primera vez que la anotaste' : `${i + 1}.ª vez · ${duracion(t - r.tiempos[i - 1])} después de la anterior`}</span></li>`).join('')}</ol>`;
  const hoja = $('#hoja'), fondo = $('#fondo');
  hoja.hidden = fondo.hidden = false;
  hoja.scrollTop = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => { hoja.classList.add('ver'); fondo.classList.add('ver'); }));
}
function cerrarDetalle() {
  const hoja = $('#hoja'), fondo = $('#fondo');
  hoja.classList.remove('ver'); fondo.classList.remove('ver');
  setTimeout(() => { hoja.hidden = fondo.hidden = true; }, 420);
}

/* ---------------- Vista: Datos (exportar / importar) ---------------- */

function pintarDatos() {
  const kb = (new Blob([aCSV(registros)]).size / 1024).toFixed(1).replace('.', ',');
  $('#infoDatos').textContent = `${registros.length.toLocaleString('es')} ${registros.length === 1 ? 'registro' : 'registros'} · ${kb} KB`;
  if (NATIVO) { $('#rutaCsv').textContent = Android.ruta(); $('#versionApp').textContent = 'Versión instalada: ' + Android.version(); }
}
const nombreArchivo = () => `placas_${claveDia(Date.now())}.csv`;

function exportar() {
  if (!registros.length) return toast('No hay registros para exportar');
  const csv = '\uFEFF' + aCSV(registros);
  if (NATIVO) return Android.exportar(nombreArchivo(), csv);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo() });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('CSV descargado');
}
function compartir() {
  if (!registros.length) return toast('No hay registros para compartir');
  if (NATIVO) Android.compartir(aCSV(registros));
  else if (navigator.share) navigator.share({ text: aCSV(registros) }).catch(() => {});
}
function importarTexto(texto) {
  if (texto == null) return toast('No se pudo leer el archivo');
  const nuevos = deCSV(texto);
  if (!nuevos.length) return toast('El archivo no tiene placas válidas');
  const modo = $('input[name=modoImp]:checked').value;
  if (modo === 'reemplazar') {
    if (registros.length && !confirm(`Se reemplazarán tus ${registros.length} registros por los ${nuevos.length} del archivo. ¿Continuar?`)) return;
    registros = nuevos;
    toast(`${nuevos.length} registros importados`);
  } else {
    const clave = r => r.p + '|' + Math.floor(r.t / 1000);
    const ya = new Set(registros.map(clave));
    let n = 0;
    for (const r of nuevos) if (!ya.has(clave(r))) { ya.add(clave(r)); registros.push(r); n++; }
    registros.sort((a, b) => a.t - b.t);
    toast(n ? `${n} registros nuevos importados` : 'Ya tenías todos esos registros');
  }
  guardar(); refrescar();
}

/* ---------------- Actualizaciones de la app ---------------- */

let urlActualizacion = null;
function buscarActualizacion() {
  if (urlActualizacion) {
    $('#estadoAct').textContent = 'Descargando… al terminar se abrirá el instalador.';
    $('#btnActualizar').disabled = true;
    return Android.instalarActualizacion(urlActualizacion);
  }
  $('#estadoAct').textContent = 'Buscando…';
  Android.buscarActualizacion();
}
// Respuestas que llegan desde la parte nativa
window.alActualizacion = r => {
  const el = $('#estadoAct'), btn = $('#btnActualizar');
  if (r.estado === 'nueva') {
    urlActualizacion = r.url;
    el.textContent = `Hay una versión nueva: ${r.version}. Tus placas se conservan al actualizar.`;
    btn.textContent = 'Descargar e instalar';
    btn.classList.add('primario');
  } else if (r.estado === 'aldia') el.textContent = 'Ya tienes la última versión.';
  else el.textContent = 'No se pudo consultar. Revisa tu conexión a internet.';
};
window.alDescarga = ok => {
  $('#btnActualizar').disabled = false;
  $('#estadoAct').textContent = ok ? 'Confirma la instalación en la ventana del sistema.' : 'Se abrió la descarga en el navegador; abre el archivo para instalar.';
};
window.alExportado = ok => toast(ok ? 'CSV guardado' : 'No se pudo guardar el CSV');
window.alImportar = importarTexto;
window.alAtras = () => {
  if (!$('#hoja').hidden) { cerrarDetalle(); return true; }
  if (vista !== 'anotar') { irA('anotar'); return true; }
  return false;
};

function borrarTodo() {
  if (!registros.length) return toast('No hay nada que borrar');
  if (!confirm(`¿Borrar los ${registros.length} registros de este celular? No se puede deshacer.`)) return;
  registros = []; guardar(); $('#resultado').innerHTML = ''; refrescar();
  toast('Registros borrados');
}

/* ---------------- Navegación y tema ---------------- */

let vista = 'anotar';
const pintores = { anotar: pintarRecientes, historial: pintarHistorial, stats: pintarStats, datos: pintarDatos };
function refrescar() { pintores[vista](); if (vista !== 'anotar') pintarRecientes(); }

function irA(nombre) {
  if (nombre === vista) return;
  vista = nombre;
  $$('.tab').forEach((b, i) => {
    const on = b.dataset.view === nombre;
    b.classList.toggle('on', on);
    if (on) { $('.tab-pill').style.setProperty('--pos', i); const h = $('#titulo'); h.textContent = b.dataset.titulo; h.classList.remove('cambia'); void h.offsetWidth; h.classList.add('cambia'); }
  });
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + nombre));
  window.scrollTo(0, 0);
  pintores[nombre]();
}

function aplicarTema(t) {
  document.documentElement.dataset.theme = t;
  $('meta[name=theme-color]').content = t === 'dark' ? '#0e1116' : '#f4f5f7';
  if (NATIVO) Android.tema(t === 'dark');
}
function cambiarTema(ev) {
  const nuevo = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(CLAVE_TEMA, nuevo); } catch (e) {}
  const r = ev.currentTarget.getBoundingClientRect(), raiz = document.documentElement.style;
  raiz.setProperty('--tx', r.left + r.width / 2 + 'px');
  raiz.setProperty('--ty', r.top + r.height / 2 + 'px');
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(() => aplicarTema(nuevo));
  else aplicarTema(nuevo);
}

/* ---------------- Inicio ---------------- */

function iniciar() {
  cargar();
  aplicarTema(document.documentElement.dataset.theme);
  pintarRecientes();

  $('#formPlaca').addEventListener('submit', agregar);
  $('#inPlaca').addEventListener('input', pintarPista);
  $('#btnTema').addEventListener('click', cambiarTema);
  $$('.tab').forEach(b => b.addEventListener('click', () => irA(b.dataset.view)));

  $('#inBuscar').addEventListener('input', () => { limite = 150; pintarHistorial(); });
  $$('.chip').forEach(c => c.addEventListener('click', () => {
    filtro = c.dataset.filtro; limite = 150;
    $$('.chip').forEach(x => x.classList.toggle('on', x === c));
    pintarHistorial();
  }));

  // Clics delegados: abrir detalle, borrar, mostrar más
  document.addEventListener('click', ev => {
    const t = ev.target;
    const det = t.closest('[data-detalle]');
    if (det) return abrirDetalle(det.dataset.detalle);
    if (t.closest('#btnMas')) { limite += 150; return pintarHistorial(); }
    const li = t.closest('.item');
    if (!li) return;
    if (t.closest('.borrar')) borrarRegistro(li);
    else if (t.closest('.abre')) abrirDetalle(li.dataset.p);
  });
  $('#btnCerrarHoja').addEventListener('click', cerrarDetalle);
  $('#fondo').addEventListener('click', cerrarDetalle);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('#hoja').hidden) cerrarDetalle(); });

  $('#btnExportar').addEventListener('click', exportar);
  $('#btnCompartir').addEventListener('click', compartir);
  $('#btnImportar').addEventListener('click', () => NATIVO ? Android.importar() : $('#inArchivo').click());
  $('#inArchivo').addEventListener('change', async ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) importarTexto(await f.text()); });
  $('#btnActualizar').addEventListener('click', buscarActualizacion);
  $$('.solo-app').forEach(el => { el.hidden = !NATIVO; });
  $('#btnBorrarTodo').addEventListener('click', borrarTodo);

}
iniciar();
