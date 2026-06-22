// app.js
// Busca o conteúdo do dia em /api/hoje e o renderiza.
// O cliente nunca recebe a coleção inteira — apenas a saudação e o exercício
// do dia, escolhidos pelo servidor.

(function () {
  "use strict";

  var saudacaoEl = document.getElementById("saudacao");
  var blocoEl = document.getElementById("exercicio-bloco");
  var categoriaEl = document.getElementById("categoria");
  var textoEl = document.getElementById("texto");
  var creditoEl = document.getElementById("credito");
  var estadoEl = document.getElementById("estado");

  function mostrarErro() {
    estadoEl.textContent =
      "Não consegui carregar o exercício de hoje. Tente recarregar a página.";
    estadoEl.hidden = false;
  }

  function render(dados) {
    if (!dados || !dados.exercicio) {
      mostrarErro();
      return;
    }

    saudacaoEl.textContent = dados.saudacao || "";

    var ex = dados.exercicio;
    categoriaEl.textContent = ex.categoria || "";

    // O campo `texto` é conteúdo estático e controlado por nós (pode conter
    // <em>…</em>). Não vem de usuários, então é seguro renderizar como HTML.
    textoEl.innerHTML = ex.texto || "";

    if (ex.credito) {
      creditoEl.textContent = ex.credito;
      creditoEl.hidden = false;
    } else {
      creditoEl.hidden = true;
    }

    estadoEl.hidden = true;
    blocoEl.hidden = false;
  }

  fetch("/api/hoje", { headers: { Accept: "application/json" } })
    .then(function (resp) {
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return resp.json();
    })
    .then(render)
    .catch(mostrarErro);
})();
