// selecao-diaria.js
// Seleciona, no lado do SERVIDOR, a saudação e o exercício do dia.
// Uma saudação por dia: muda à meia-noite no fuso de São Paulo e
// repete o ciclo a cada 24 dias (são 24 saudações).
// O exercício do dia usa o mesmo princípio, mas o ciclo dele acompanha
// automaticamente o tamanho de musa-exercicios.json (dia % exercicios.length) —
// não precisa editar este arquivo quando a coleção crescer.
//
// Use este módulo apenas dentro da função serverless (ex.: /api/hoje).
// Os arquivos de dados ficam fora da pasta pública e NUNCA vão ao cliente.

const fs = require("fs");
const path = require("path");

// Carrega os dados do lado do servidor (pasta /data, não publicada).
const saudacoes = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "saudacoes.json"), "utf8")
);
const exercicios = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "musa-exercicios.json"), "utf8")
);

// Quantos dias se passaram desde a "época", contados à meia-noite de São Paulo.
// Derivado SEMPRE do relógio do servidor — nunca de parâmetros do cliente.
function diasDesdeEpoca() {
  const agora = new Date();
  // Data no fuso America/Sao_Paulo, no formato AAAA-MM-DD.
  const dataSP = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const meiaNoiteUTC = Date.parse(dataSP + "T00:00:00Z");
  return Math.floor(meiaNoiteUTC / 86400000);
}

// Retorna { saudacao, exercicio } do dia atual.
// Módulos independentes para que saudação e exercício não andem travados juntos.
function conteudoDoDia() {
  const dia = diasDesdeEpoca();

  const saudacao = saudacoes[dia % saudacoes.length];

  const ex = exercicios[dia % exercicios.length];
  const exercicio = {
    texto: ex.texto,
    categoria: ex.categoria,
  };
  if (ex.credito) exercicio.credito = ex.credito; // só inclui se existir

  // Não exponha id, índice ou total: nada que revele/permita varrer a coleção.
  return { saudacao, exercicio };
}

module.exports = { conteudoDoDia };

/* Exemplo de uso na função serverless (Vercel):
 *
 * const { conteudoDoDia } = require("./selecao-diaria");
 * module.exports = (req, res) => {
 *   res.setHeader("Cache-Control", "public, max-age=300"); // cache curto
 *   res.status(200).json(conteudoDoDia());
 * };
 */
