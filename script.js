// Conteúdo completo para o arquivo script.js

document.addEventListener('DOMContentLoaded', () => {
  // Estado global
  let meusJogos = [];
  let historico = [];
  let freq = Array(26).fill(0);
  let lastDraw = [];
  let somaMed = 0, paresMed = 0;
  let freqChartInstance = null;

  // --- INICIALIZAÇÃO DA INTERFACE ---
  function initUI() {
    const numbersGrid = document.getElementById('numbersGrid');
    for (let i = 1; i <= 25; i++) {
      const el = document.createElement('div');
      el.className = 'number';
      el.textContent = i.toString().padStart(2, '0');
      el.dataset.number = i;
      el.addEventListener('click', () => el.classList.toggle('selected'));
      numbersGrid.appendChild(el);
    }
    
    document.getElementById('btnGerar').addEventListener('click', handleGerar);
    document.getElementById('btnGerarLote').addEventListener('click', handleGerarLote);
    document.getElementById('btnExport').addEventListener('click', handleExport);
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileImport').click());
    document.getElementById('fileImport').addEventListener('change', handleImport);
    document.getElementById('btnLimpar').addEventListener('click', handleLimpar);
    document.getElementById('btnVerificarAcertos').addEventListener('click', handleVerificarAcertos);
    document.getElementById('btnSimular').addEventListener('click', handleSimular);

    carregarCSV();
  }

  // --- FUNÇÕES UTILITÁRIAS ---
  const sum = arr => arr.reduce((a, b) => a + b, 0);
  const countEven = arr => arr.filter(n => n % 2 === 0).length;
  const formatJogo = arr => arr.slice().sort((a, b) => a - b);
  const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
  };

  // --- LÓGICA DE CARREGAMENTO E PROCESSAMENTO DE DADOS ---
  async function carregarCSV() {
    const status = document.getElementById('statusCSV');
    const url = 'https://github.com/Tchocco/perseveran-a/blob/main/resultados.csv';
    
    try {
      const resp = await fetch(url, { cache: 'no-store' } );
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const text = await resp.text();
      historico = parseCSV(text);
      if (historico.length === 0) throw new Error('CSV vazio ou formato inválido');
      
      processarDadosCarregados();

      status.textContent = `Resultados carregados! (${historico.length} concursos)`;
      status.style.backgroundColor = 'var(--success)';
      status.style.color = '#fff';

    } catch (e) {
      console.error('Falha ao carregar ou processar o CSV:', e);
      status.textContent = 'Falha ao carregar resultados. Análise desativada.';
      status.style.backgroundColor = 'var(--danger)';
      status.style.color = '#fff';
    }
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      if (cols.length < 17) continue;
      const concurso = cols[0];
      const data = cols[1];
      const nums = cols.slice(2, 17).map(v => parseInt(v, 10)).filter(n => !isNaN(n));
      if (nums.length === 15) out.push({ concurso, data, numeros: formatJogo(nums) });
    }
    return out;
  }

  function processarDadosCarregados() {
    calcularEstatisticas();
    listarHistorico(historico.slice(-30).reverse());
    atualizarVerificador();
    
    document.getElementById('pesoFrequencia').disabled = false;
    document.getElementById('pesoRecencia').disabled = false;
    document.getElementById('evitarRepeticao').disabled = false;
    document.getElementById('verificadorJogoSelect').disabled = false;
    document.getElementById('verificadorConcursoSelect').disabled = false;
    document.getElementById('btnVerificarAcertos').disabled = false;
  }

  function calcularEstatisticas() {
    freq = Array(26).fill(0);
    let somaTotal = 0, paresTotal = 0;
    for (const h of historico) {
      somaTotal += sum(h.numeros);
      paresTotal += countEven(h.numeros);
      for (const n of h.numeros) freq[n]++;
    }
    somaMed = +(somaTotal / historico.length).toFixed(2);
    paresMed = +(paresTotal / historico.length).toFixed(2);
    
    setText('qtdConcursos', `Concursos: ${historico.length}`);
    setText('ultimoConcurso', `Último: ${historico[historico.length - 1].concurso} (${historico[historico.length - 1].data})`);
    setText('mediaSoma', `Soma média: ${somaMed}`);
    setText('paresMedios', `Pares médios: ${paresMed}`);
    const ranking = [...Array(25)].map((_, i) => ({ n: i + 1, f: freq[i + 1] }))
      .sort((a, b) => b.f - a.f).slice(0, 5).map(x => x.n.toString().padStart(2, '0')).join(' ');
    setText('maisFrequentes', `Top frequentes: ${ranking}`);
    lastDraw = historico[historico.length - 1]?.numeros ?? [];
    
    renderizarGraficoFrequencia();
  }

  // --- LÓGICA DE GERAÇÃO DE JOGOS ---
  function handleGerar() {
    const cfg = coletarConfig();
    const selec = [...document.querySelectorAll('.number.selected')].map(el => parseInt(el.dataset.number, 10));
    let jogo = [];
    if (selec.length > 0 && selec.length <= 15) {
      const base = new Set(selec);
      for (let tent = 0; tent < 10000; tent++) {
        const cand = new Set(base);
        while (cand.size < 15) cand.add(1 + Math.floor(Math.random() * 25));
        const arr = formatJogo(Array.from(cand));
        if (validarJogo(arr, cfg)) {
          jogo = arr;
          break;
        }
      }
      if (jogo.length === 0) {
        const finalJogo = new Set(selec);
        while (finalJogo.size < 15) finalJogo.add(1 + Math.floor(Math.random() * 25));
        jogo = formatJogo(Array.from(finalJogo));
      }
    } else {
      jogo = gerarJogoComPesos(cfg);
    }
    if (jogo.length === 0) {
      alert('Não foi possível gerar com esses filtros. Ajuste os limites.');
      return;
    }
    renderJogos([jogo], 'jogosGerados');
  }

  function handleGerarLote() {
    const cfg = coletarConfig();
    const out = new Set();
    const maxTentativas = 50000;
    let tentativas = 0;
    while (out.size < 10 && tentativas < maxTentativas) {
      const j = gerarJogoComPesos(cfg);
      if (j.length) out.add(j.join(','));
      tentativas++;
    }
    if (out.size === 0) {
      alert('Não foi possível gerar jogos com esses filtros.');
      return;
    }
    const jogosGerados = Array.from(out).map(s => s.split(',').map(Number));
    renderJogos(jogosGerados, 'jogosGerados');
  }

  function gerarJogoComPesos(config) {
    if (historico.length === 0) return gerarJogoAleatorio(config);

    for (let tent = 0; tent < 5000; tent++) {
      const candidatos = [];
      for (let n = 1; n <= 25; n++) {
        const score = pontuarNumero(n, config.pesoFrequencia, config.pesoRecencia);
        candidatos.push({ n, score });
      }
      candidatos.sort((a, b) => b.score - a.score);
      
      const top = candidatos.slice(0, 15 + Math.floor(Math.random() * 6)).map(c => c.n);
      const pool = new Set(top);
      while (pool.size < 25) pool.add(1 + Math.floor(Math.random() * 25));
      const arr = Array.from(pool);
      const escolha = [];
      while (escolha.length < 15) {
        const idx = Math.floor(Math.random() * arr.length);
        escolha.push(arr.splice(idx, 1)[0]);
      }
      const jogo = formatJogo(escolha);
      if (validarJogo(jogo, config)) return jogo;
    }
    return gerarJogoAleatorio(config);
  }

  function gerarJogoAleatorio(config) {
    for (let tent = 0; tent < 10000; tent++) {
      const jogo = [];
      while (jogo.length < 15) {
        const n = 1 + Math.floor(Math.random() * 25);
        if (!jogo.includes(n)) jogo.push(n);
      }
      const jogoFormatado = formatJogo(jogo);
      if (validarJogo(jogoFormatado, config)) return jogoFormatado;
    }
    return [];
  }

  function validarJogo(jogo, config) {
    const pares = countEven(jogo);
    const s = sum(jogo);
    const repet = lastDraw.length ? jogo.filter(n => lastDraw.includes(n)).length : 0;

    if (pares < config.minEven || pares > config.maxEven) return false;
    if (s < config.minSum || s > config.maxSum) return false;
    if (historico.length > 0 && config.evitarRepeticao === 'sim' && repet >= 10) return false;
    
    return true;
  }

  function pontuarNumero(n, pesoFreq, pesoRecencia) {
    const f = freq[n] || 0;
    const saiuNoUltimo = lastDraw.includes(n) ? 1 : 0;
    const recenciaScore = saiuNoUltimo ? -1 : 1;
    return f * pesoFreq + recenciaScore * pesoRecencia + Math.random() * 0.5;
  }

  function coletarConfig() {
    return {
      minEven: parseInt(document.getElementById('minEven').value) || 0,
      maxEven: parseInt(document.getElementById('maxEven').value) || 15,
      minSum: parseInt(document.getElementById('minSum').value) || 15,
      maxSum: parseInt(document.getElementById('maxSum').value) || 325,
      pesoFrequencia: parseInt(document.getElementById('pesoFrequencia').value) || 0,
      pesoRecencia: parseInt(document.getElementById('pesoRecencia').value) || 0,
      evitarRepeticao: document.getElementById('evitarRepeticao').value
    };
  }

  // --- RENDERIZAÇÃO E UI ---
  function renderJogos(jogos, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    jogos.forEach((jogo, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'jogo';
      const numbersContainer = document.createElement('div');
      numbersContainer.style.display = 'flex';
      numbersContainer.style.flexWrap = 'wrap';
      numbersContainer.style.gap = '8px';
      jogo.forEach(num => {
        const el = document.createElement('div');
        el.className = 'jogo-number';
        el.textContent = num.toString().padStart(2, '0');
        numbersContainer.appendChild(el);
      });
      wrap.appendChild(numbersContainer);
      const actions = document.createElement('div');
      actions.className = 'jogo-actions';
      if (containerId === 'jogosGerados') {
        const add = document.createElement('button');
        add.className = 'btn btn-success';
        add.textContent = 'Adicionar';
        add.onclick = () => {
          meusJogos.push(jogo);
          renderJogos(meusJogos, 'meusJogosList');
          atualizarVerificador();
        };
        actions.appendChild(add);
      } else {
        const rem = document.createElement('button');
        rem.className = 'btn btn-danger';
        rem.textContent = 'Remover';
        rem.onclick = () => {
          meusJogos.splice(idx, 1);
          renderJogos(meusJogos, 'meusJogosList');
          atualizarVerificador();
        };
        actions.appendChild(rem);
      }
      wrap.appendChild(actions);
      container.appendChild(wrap);
    });
  }

  function listarHistorico(lista) {
    const box = document.getElementById('historicoLista');
    box.innerHTML = '';
    for (const h of lista) {
      const div = document.createElement('div');
      div.className =

