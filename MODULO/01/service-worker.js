/**
 * ============================================================
 * ALMOXA PRO — service-worker.js
 * FASE 9 (PWA) — PREPARADO PRA EVOLUÇÃO FUTURA DE HOSPEDAGEM.
 *
 * ESTE ARQUIVO NÃO ESTÁ ATIVO NO APP HOJE. Não foi incluído em
 * nenhum <script> nem registrado via navigator.serviceWorker
 * .register() em lugar nenhum do Front.
 *
 * MOTIVO (confirmado, não é escolha nossa — ver relatório da
 * Fase 9): Service Worker precisa ser servido como arquivo
 * próprio, na mesma origem da página, e não pode ser registrado
 * de dentro de um <iframe> (é a própria especificação do padrão
 * Service Worker que proíbe isso). O Google Apps Script serve
 * TODO conteúdo do HtmlService dentro de um iframe (é assim que
 * o sandboxing de segurança do Apps Script funciona) e só serve
 * "uma página por requisição" — não dá pra publicar um arquivo
 * .js separado num caminho fixo tipo /service-worker.js.
 *
 * Isso é confirmado pela própria comunidade de desenvolvedores
 * do Apps Script: quem precisa de PWA de verdade (com Service
 * Worker funcionando) hospeda os arquivos estáticos (HTML, CSS,
 * JS, manifest, este arquivo) em outro lugar — GitHub Pages,
 * Firebase Hosting, Cloud Run — e mantém o Apps Script só como
 * BACKEND (API), chamado via fetch() com autenticação, em vez de
 * via HtmlService/google.script.run.
 *
 * QUANDO ESSA EVOLUÇÃO ACONTECER: este arquivo já está pronto.
 * Só precisa:
 *   1. Publicar o Front (HTML/CSS/JS) na nova hospedagem.
 *   2. Trocar google.script.run por fetch() chamando o Apps
 *      Script como Web App via HTTP (doPost já existe e já
 *      aceita esse formato — Code.gs não precisa mudar).
 *   3. Registrar este arquivo: navigator.serviceWorker.register('/service-worker.js')
 *   4. Servir o manifest.json como arquivo estático de verdade
 *      (não mais via ?manifest=1).
 * ============================================================
 */

const CACHE_NAME = 'almoxa-pro-v1';

// Assets estáticos cacheáveis com segurança (nunca dados de
// negócio — estoque, solicitação, etc. sempre vêm da rede,
// nunca do cache, pra não mostrar informação desatualizada
// como se fosse atual — seção 51 da spec: "não inventar
// comportamento offline pra operações críticas").
const ASSETS_ESTATICOS = [
  '/',
  '/manifest.json'
  // Quando hospedado como arquivos estáticos de verdade, listar
  // aqui os .css/.js que hoje são includes do Apps Script.
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS_ESTATICOS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(
        nomes.filter(function (nome) { return nome !== CACHE_NAME; })
             .map(function (nome) { return caches.delete(nome); })
      );
    })
  );
  self.clients.claim();
});

/**
 * Estratégia: cache-first SÓ pra assets estáticos (shell do
 * app); qualquer chamada de API (fetch pro backend) vai direto
 * pra rede, sem cache — dado de negócio nunca fica velho
 * escondido atrás de um Service Worker.
 */
self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);
  const ehAssetEstatico = ASSETS_ESTATICOS.some(function (caminho) { return url.pathname === caminho; });

  if (!ehAssetEstatico) return; // deixa passar direto pra rede

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
