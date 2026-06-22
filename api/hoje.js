// api/hoje.js
// Único endpoint público: GET /api/hoje
// Responde apenas com a saudação e o exercício do dia atual, calculados
// pelo relógio do SERVIDOR (fuso America/Sao_Paulo). Qualquer parâmetro de
// data, índice ou id vindo do cliente é IGNORADO — isso impede que alguém
// enumere a coleção trocando a query string.

const { conteudoDoDia } = require("./selecao-diaria");

// ---------------------------------------------------------------------------
// Rate limit simples por IP (em memória, por instância "quente" da função).
// Não é uma defesa absoluta — instâncias serverless são efêmeras —, mas
// segura rajadas de um mesmo IP. A defesa principal contra extração em massa
// é arquitetural: a função só revela 1 item por dia.
// ---------------------------------------------------------------------------
const JANELA_MS = 60 * 1000; // 1 minuto
const MAX_REQ = 30; // máx. de requisições por IP por janela
const acessos = new Map(); // ip -> { contador, reinicioEm }

function limitado(ip) {
  const agora = Date.now();
  const registro = acessos.get(ip);
  if (!registro || agora > registro.reinicioEm) {
    acessos.set(ip, { contador: 1, reinicioEm: agora + JANELA_MS });
    return false;
  }
  registro.contador += 1;
  return registro.contador > MAX_REQ;
}

function ipDoCliente(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || "desconhecido";
}

// CORS restrito à própria origem: só respondemos a requisições same-origin.
// Requisições same-origin do navegador não enviam o header Origin; quando ele
// vem e não bate com o host da requisição, recusamos.
function origemPermitida(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin (sem header Origin) ou navegação direta
  const host = req.headers.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

module.exports = (req, res) => {
  // Apenas GET.
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ erro: "Método não permitido." });
    return;
  }

  if (!origemPermitida(req)) {
    res.status(403).json({ erro: "Origem não permitida." });
    return;
  }

  const ip = ipDoCliente(req);
  if (limitado(ip)) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ erro: "Muitas requisições. Tente novamente em instantes." });
    return;
  }

  // Cache curto: ajuda a aliviar carga sem revelar nada além do dia atual.
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Nota: parâmetros de req.query são deliberadamente ignorados.
  res.status(200).json(conteudoDoDia());
};
