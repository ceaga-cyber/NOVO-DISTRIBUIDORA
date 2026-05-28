# Catálogo Distribuidora 2K — Peças iPhone

Catálogo online com carrinho, cálculo de frete via Melhor Envio, finalização
pelo WhatsApp e **geração automática de etiqueta no carrinho do Melhor Envio**.

## 📁 Estrutura

```
projeto/
├── index.html                              ← Página do catálogo
├── netlify.toml                            ← Configuração
└── netlify/functions/
    ├── calcular-frete.js                   ← Cotação PAC/SEDEX
    └── adicionar-carrinho-me.js            ← Cria envio no painel ME
```

## 🏪 Dados do Remetente (já configurados no código)

Os seguintes dados estão pré-preenchidos como padrão:

| Campo        | Valor               |
|--------------|---------------------|
| Nome         | Distribuidora 2K    |
| CPF          | 424.734.228-26      |
| CEP          | 13.214-101          |
| Endereço     | Rua Itirapina, 1060 |
| Complemento  | Sala 35             |
| Cidade/UF    | Jundiaí / SP        |

Esses valores são usados automaticamente como **remetente da etiqueta** quando
um pedido é criado. Se precisar trocar depois, é só configurar variáveis de
ambiente (veja seção 4 abaixo).

---

## 🚀 Fluxo de pedido com etiqueta automática

```
1. Cliente adiciona peças ao carrinho do catálogo
2. Calcula frete (PAC ou SEDEX)
3. Preenche endereço + CPF/CNPJ
4. Clica "Fechar no WhatsApp"
   ↓
5. Sistema cria envio no CARRINHO do Melhor Envio
   (não cobra você ainda — fica como "rascunho")
   ↓
6. Abre WhatsApp com a mensagem do pedido + ID do envio
   ↓
7. Cliente paga você (Pix/cartão por fora)
   ↓
8. Você acessa: https://melhorenvio.com.br/painel/carrinho
   ↓
9. Encontra o envio com o ID, clica "Comprar"
   → debita do seu saldo → gera a etiqueta
10. Imprime PDF, cola no pacote, posta nos Correios ✅
```

⚠️ **O carrinho do ME mantém o envio por 7 dias.** Se o cliente não pagar
nesse prazo, é só não comprar — expira sozinho sem custo nenhum pra você.

---

## 1️⃣ Personalizar o `index.html`

Abra e troque APENAS estas 2 linhas (no início do `<script>`):

```js
const WHATSAPP_LOJA = "5511999998888";        // SEU número (55 + DDD + número)
const NOME_LOJA = "Distribuidora 2K";          // Nome da sua loja
```

## 2️⃣ Token do Melhor Envio

Acesse: **https://melhorenvio.com.br/painel/gerenciar/tokens**
(ou **sandbox.melhorenvio.com.br/painel/gerenciar/tokens** para testes)

Clique em **Novo Token** e marque pelo menos:

- ✅ `shipping-calculate` — cotação de frete
- ✅ `cart-write` — inserir envio no carrinho (geração automática)
- ✅ `cart-read` — opcional, recomendado

Ou marque "Selecionar todas" pra simplificar.

⚠️ **Copie o token todo** (é longo) — só aparece uma vez!

## 3️⃣ Deploy no Netlify

**Opção A — Drag & drop:**
Arraste a pasta `projeto` inteira em https://app.netlify.com/drop

**Opção B — GitHub:**
Suba pra um repositório e conecte no Netlify.

## 4️⃣ Variáveis de Ambiente no Netlify

**Site configuration → Environment variables**

### 🔑 Obrigatórias:

| Nome                    | Valor                                     |
|-------------------------|-------------------------------------------|
| `MELHORENVIO_TOKEN`     | (cole seu access_token)                   |
| `MELHORENVIO_AMBIENTE`  | `sandbox` ou `producao`                   |

### 📞 Opcionais (recomendado configurar):

| Nome              | Valor de exemplo            | O que é                       |
|-------------------|------------------------------|-------------------------------|
| `LOJA_TELEFONE`   | 11999998888                  | Seu telefone (só números)     |
| `LOJA_EMAIL`      | [email protected]      | Seu email                     |
| `LOJA_BAIRRO`     | Vila Arens                   | Bairro do remetente           |

### ✏️ Sobrescrever defaults (só se precisar):

Se você for trocar de endereço ou nome no futuro, pode configurar:

| Nome              | O que é                                |
|-------------------|----------------------------------------|
| `LOJA_NOME`       | Nome do remetente                      |
| `LOJA_DOCUMENTO`  | CPF/CNPJ                               |
| `LOJA_CEP`        | CEP                                    |
| `LOJA_ENDERECO`   | Logradouro                             |
| `LOJA_NUMERO`     | Número                                 |
| `LOJA_COMPLEMENTO`| Complemento                            |
| `LOJA_CIDADE`     | Cidade                                 |
| `LOJA_UF`         | Estado (2 letras)                      |

⚠️ Depois de adicionar TODAS as variáveis, vá em **Deploys → Trigger deploy
→ Deploy site** para reiniciar.

## 5️⃣ Testar

Recomendo começar pelo **sandbox** (saldo fictício de R$ 10.000, sem risco):

1. Crie conta em https://sandbox.melhorenvio.com.br
2. Gere token sandbox lá
3. Configure `MELHORENVIO_AMBIENTE = sandbox` no Netlify
4. Faça um pedido teste no seu site
5. Verifique se apareceu em **sandbox.melhorenvio.com.br/painel/carrinho**

Quando estiver redondo, troque pra produção:
1. Gere token em melhorenvio.com.br
2. Atualize `MELHORENVIO_TOKEN` (novo) e `MELHORENVIO_AMBIENTE = producao`
3. Redeploy

---

## 🆘 Problemas comuns

**"MELHORENVIO_TOKEN não configurado"**
→ Faltou variável de ambiente ou redeploy depois de adicionar.

**"Unauthenticated" / 401**
→ Token expirou (validade de 30 dias), ou está usando token de sandbox no
ambiente de produção (ou vice-versa).

**Envio não aparece no painel do Melhor Envio**
→ Verifique se está olhando o ambiente correto (sandbox.melhorenvio.com.br
vs melhorenvio.com.br).

**Etiqueta criada mas WhatsApp não enviou**
→ A criação da etiqueta e o WhatsApp são processos independentes. Mesmo
que a criação no ME falhe, o WhatsApp ainda abre normalmente.

**Cliente preencheu CPF inválido**
→ O sistema valida CPF/CNPJ usando o algoritmo oficial antes de processar.
Números de teste como "111.111.111-11" são rejeitados.

## 🔒 Segurança

- Seu token do Melhor Envio fica **no servidor** (variável de ambiente)
- Nunca aparece no HTML público
- CPF/CNPJ do cliente é validado por algoritmo oficial antes do envio
- A geração de etiqueta NÃO cobra você — só fica no carrinho até você comprar
- Se o cliente desistir, etiqueta expira sozinha em 7 dias sem custo
