# Musa

Um site que apresenta **um exercício de escrita criativa por dia**. A função do
site é dar a fagulha inicial: ele mostra o exercício do dia e a pessoa segue
sozinha a partir dali. Não é uma ferramenta de escrita — é uma oficina
silenciosa. O protagonista da tela é sempre o exercício.

São **182 exercícios** distribuídos em **14 categorias** e **24 saudações**.
Todo dia, à meia-noite no fuso `America/Sao_Paulo`, o site mostra um novo
exercício e uma nova saudação, iguais para todo mundo.

## Arquitetura

```
musa/
├── api/
│   ├── hoje.js              # Função serverless: GET /api/hoje
│   ├── selecao-diaria.js    # Seleção determinística do dia (lado servidor)
│   └── data/                # Dados NÃO publicados como estáticos
│       ├── musa-exercicios.json
│       └── saudacoes.json
├── public/                  # Frontend estático (servido pela Vercel)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── vercel.json
└── package.json
```

- **Frontend estático** (`public/`) + **uma única função serverless**
  (`api/hoje.js`). Sem frameworks pesados: HTML, CSS e JS puro.
- Os dados ficam em `api/data/`. Essa pasta **não** é servida como conteúdo
  estático (só `public/` é) e **nunca** entra no bundle do cliente.

> **Por que `api/data/` e não `/data/`?**
> O módulo `selecao-diaria.js` (fornecido e usado **exatamente como está**) lê
> os dados com `path.join(__dirname, "data", ...)`. Como ele vive em `api/`,
> os arquivos precisam ficar em `api/data/`. O `includeFiles` do `vercel.json`
> aponta para `api/data/**` justamente por isso.

## A estratégia de segurança

O requisito crítico é que **o navegador nunca receba a coleção inteira**.
Ninguém deve conseguir extrair todos os exercícios inspecionando o
código-fonte, o bundle, o painel de rede ou source maps.

Como isso é garantido:

1. **Dados só no servidor.** `api/data/*.json` é lido por `fs.readFileSync`
   dentro da função. Nada disso é publicado como arquivo estático nem entra no
   JS do cliente.
2. **Um único endpoint mínimo.** `GET /api/hoje` devolve **apenas** o exercício
   e a saudação do dia:
   ```json
   { "saudacao": "...", "exercicio": { "texto": "...", "categoria": "...", "credito": "..."? } }
   ```
   O cache (`Cache-Control`) é alinhado à virada do dia: o `max-age` é o número
   de segundos até a próxima meia-noite em `America/Sao_Paulo`, então o conteúdo
   expira exatamente quando o exercício muda — nada de servir o item anterior
   depois da virada.
   Não há `id`, número sequencial nem total — nada que revele o tamanho da
   coleção ou permita iterar.
3. **Índice calculado pelo relógio do servidor** (`America/Sao_Paulo`).
   **Qualquer parâmetro de data, índice ou id vindo do cliente é ignorado**,
   então não dá para enumerar a coleção trocando a query string.
4. **CORS restrito à própria origem.** Requisições cross-origin são recusadas
   (403).
5. **Rate limit simples por IP** (30 req/min por instância quente), para conter
   rajadas.
6. **Sem source maps em produção** e sem build de cliente — não há bundle do
   qual extrair dados.

> A extração lenta (1 item por dia) é teoricamente possível — alguém poderia
> coletar um exercício por dia ao longo de meses. Mas a **extração em massa
> está bloqueada por design**: não existe nenhum caminho que devolva mais de um
> item por requisição.

### Conteúdo em HTML (`<em>…</em>`)

O campo `texto` pode conter tags simples `<em>…</em>`, usadas para destacar
citações e palavras-chave. Esse conteúdo é **estático e controlado por nós** —
não vem de usuários —, então é seguro renderizá-lo como HTML. O frontend usa
`innerHTML` para o texto do exercício (ver `public/app.js`). Como a origem é
confiável e nenhuma entrada de usuário é incorporada, não há risco de XSS.

### Crédito

Alguns exercícios trazem o campo `credito`, citando a fonte que inspirou a
adaptação. Quando ele existe, é exibido de forma discreta ao pé do exercício.

## Rodando localmente

Pré-requisito: [Vercel CLI](https://vercel.com/docs/cli).

```bash
npm install -g vercel   # se ainda não tiver
vercel dev              # ou: npm run dev
```

Acesse `http://localhost:3000`. O `vercel dev` serve `public/` como estático e
roteia `/api/hoje` para a função, incluindo os arquivos de `api/data/`.

## Deploy na Vercel

```bash
vercel          # primeira vez (cria o projeto)
vercel --prod   # publica em produção  (ou: npm run deploy)
```

Pontos importantes do `vercel.json`:

```json
{
  "functions": {
    "api/hoje.js": { "includeFiles": "api/data/**" }
  }
}
```

Funções serverless **não incluem automaticamente** arquivos lidos por
`fs.readFileSync`. O `includeFiles` garante que `api/data/**` seja empacotado
junto da função — sem isso, o `fs.readFileSync` funciona localmente mas quebra
no deploy.

## Trocando de provedor

A lógica de seleção (`api/selecao-diaria.js`) é JS puro com `fs`/`path`, então
migra com pouco esforço. Só muda o "envelope" da função (`api/hoje.js`):

### Netlify Functions

- Mova/aponte a função para `netlify/functions/hoje.js`.
- Adapte a assinatura para o handler da Netlify:
  ```js
  const { conteudoDoDia } = require("./selecao-diaria");
  exports.handler = async () => ({
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    body: JSON.stringify(conteudoDoDia()),
  });
  ```
- Garanta o empacotamento dos dados com
  `included_files = ["netlify/functions/data/**"]` no `netlify.toml` (e ajuste o
  caminho lido por `selecao-diaria.js`, ou mantenha `data/` ao lado da função).
- Publique `public/` como diretório estático e crie um redirect de
  `/api/hoje` → `/.netlify/functions/hoje`.

### Cloudflare Workers

- Workers não têm `fs`. Importe os JSON diretamente no bundle do Worker
  (`import exercicios from "./data/musa-exercicios.json"`) e reescreva a leitura
  de arquivos como import estático — o bundle do Worker **não** é exposto ao
  cliente, então a coleção continua protegida.
- Mantenha o cálculo de `diasDesdeEpoca()` igual (usa `Intl.DateTimeFormat`,
  disponível no runtime do Workers).
- Sirva `public/` via Cloudflare Pages e exponha o Worker em `/api/hoje`.

## Restrições de produto

- O site **não recebe nenhuma informação do usuário**: sem campos de texto,
  formulários, login ou armazenamento. É **somente exibição**.
- **Sem coleta de dados pessoais**: sem analytics invasivo, sem cookies de
  rastreamento, sem scripts de terceiros desnecessários (apenas a fonte Inter
  via Google Fonts).
