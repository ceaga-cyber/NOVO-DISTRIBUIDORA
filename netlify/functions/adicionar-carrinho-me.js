// netlify/functions/adicionar-carrinho-me.js
//
// Adiciona o pedido ao CARRINHO do Melhor Envio (não compra, não debita saldo).
// O lojista decide depois, dentro do painel do Melhor Envio, quando comprar
// e gerar a etiqueta de verdade — após confirmação do pagamento do cliente.
//
// O carrinho do Melhor Envio mantém esse pedido por 7 dias. Se não for comprado,
// expira automaticamente sem custo.
//
// VARIÁVEIS DE AMBIENTE OBRIGATÓRIAS:
//   MELHORENVIO_TOKEN       — Access token com scopes:
//                             shipping-calculate + cart-write + cart-read
//   MELHORENVIO_AMBIENTE    — "sandbox" ou "producao"
//
// REMETENTE — DEFAULTS (Distribuidora 2K):
//   LOJA_NOME         = Distribuidora 2K
//   LOJA_DOCUMENTO    = 42473422826
//   LOJA_CEP          = 13214101
//   LOJA_ENDERECO     = Rua Itirapina
//   LOJA_NUMERO       = 1060
//   LOJA_COMPLEMENTO  = Sala 35
//   LOJA_UF           = SP
//   LOJA_CIDADE       = Jundiaí
//
// VARIÁVEIS OPCIONAIS (recomendado configurar para a etiqueta ficar completa):
//   LOJA_TELEFONE     — Telefone só números (padrão fictício se não definir)
//   LOJA_EMAIL        — Email da loja
//   LOJA_BAIRRO       — Bairro

const ALTURA = 8;
const LARGURA = 13;
const COMPRIMENTO = 18;
const PESO_KG = 0.3;

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const dados = JSON.parse(event.body || "{}");

    // Campos esperados do front:
    // {
    //   servico_id: 1 ou 2 (1=PAC, 2=SEDEX),
    //   cliente: { nome, documento, telefone?, email? },
    //   endereco_destino: { cep, rua, numero, complemento?, bairro, cidade, uf },
    //   itens: [{ nome, qtd, preco_unitario }],
    //   valor_total: number (subtotal do pedido sem frete)
    // }

    const required = ["servico_id", "cliente", "endereco_destino", "itens", "valor_total"];
    for (const r of required) {
      if (dados[r] === undefined || dados[r] === null) {
        return {
          statusCode: 400, headers,
          body: JSON.stringify({ error: `Campo obrigatório ausente: ${r}` }),
        };
      }
    }

    const token = process.env.MELHORENVIO_TOKEN;
    if (!token) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "MELHORENVIO_TOKEN não configurado" }) };
    }

    // ============================================================
    // DADOS DO REMETENTE (DISTRIBUIDORA 2K)
    // Você pode sobrescrever via variáveis de ambiente no Netlify
    // ============================================================
    const remetente = {
      name: process.env.LOJA_NOME || "Distribuidora 2K",
      phone: (process.env.LOJA_TELEFONE || "11950801016").replace(/\D/g, ""),
      email: process.env.LOJA_EMAIL || "[email protected]",
      document: (process.env.LOJA_DOCUMENTO || "42473422826").replace(/\D/g, ""),
      address: process.env.LOJA_ENDERECO || "Rua Itirapina",
      complement: process.env.LOJA_COMPLEMENTO || "Sala 35",
      number: process.env.LOJA_NUMERO || "1060",
      district: process.env.LOJA_BAIRRO || "Centro",
      city: process.env.LOJA_CIDADE || "Jundiaí",
      state_abbr: (process.env.LOJA_UF || "SP").toUpperCase(),
      country_id: "BR",
      postal_code: (process.env.LOJA_CEP || "13214101").replace(/\D/g, ""),
    };

    const ambiente = (process.env.MELHORENVIO_AMBIENTE || "sandbox").toLowerCase();
    const baseUrl = ambiente === "producao"
      ? "https://melhorenvio.com.br"
      : "https://sandbox.melhorenvio.com.br";

    // Monta endereço do destinatário
    const destDoc = String(dados.cliente.documento || "").replace(/\D/g, "");
    const destinatario = {
      name: dados.cliente.nome,
      phone: (dados.cliente.telefone || "").replace(/\D/g, "") || "11999999999",
      email: dados.cliente.email || "[email protected]",
      document: destDoc,
      address: dados.endereco_destino.rua,
      complement: dados.endereco_destino.complemento || "",
      number: dados.endereco_destino.numero,
      district: dados.endereco_destino.bairro,
      city: dados.endereco_destino.cidade,
      state_abbr: (dados.endereco_destino.uf || "").toUpperCase(),
      country_id: "BR",
      postal_code: String(dados.endereco_destino.cep || "").replace(/\D/g, ""),
    };

    // Determina se é PF ou PJ pelo tamanho do documento
    if (destDoc.length === 14) {
      destinatario.company_document = destDoc;
    }

    // Monta produtos
    const produtos = (dados.itens || []).map((i, idx) => ({
      name: i.nome || `Item ${idx + 1}`,
      quantity: String(i.qtd || 1),
      unitary_value: String(Number(i.preco_unitario || 0).toFixed(2)),
    }));

    // Volume (1 pacote único com a soma)
    const volumes = [{
      height: ALTURA,
      width: LARGURA,
      length: COMPRIMENTO,
      weight: PESO_KG,
    }];

    const payload = {
      service: Number(dados.servico_id), // 1 = PAC, 2 = SEDEX
      from: remetente,
      to: destinatario,
      products: produtos,
      volumes: volumes,
      options: {
        insurance_value: Number(dados.valor_total) || 0,
        receipt: false,
        own_hand: false,
        reverse: false,
        non_commercial: destDoc.length === 11, // se for CPF, declaração de conteúdo
      },
    };

    const resp = await fetch(`${baseUrl}/api/v2/me/cart`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Catalogo Pecas iPhone Premium ([email protected])",
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({
          error: "Erro ao inserir no carrinho do Melhor Envio",
          status: resp.status,
          details: data,
        }),
      };
    }

    // Sucesso! data.id = id do envio no Melhor Envio
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        sucesso: true,
        id_envio: data.id,
        protocol: data.protocol || null,
        servico: data.service_id,
        mensagem: "Pedido adicionado ao carrinho do Melhor Envio. Acesse o painel para comprar e gerar a etiqueta.",
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Erro interno: " + err.message }),
    };
  }
};
