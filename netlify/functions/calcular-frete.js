// netlify/functions/calcular-frete.js
//
// Esta função roda no servidor do Netlify (não no navegador do cliente).
// Ela recebe o CEP de destino, chama a API do Melhor Envio com o token
// secreto (que fica nas variáveis de ambiente do Netlify) e devolve os
// fretes filtrados (apenas PAC e SEDEX dos Correios).
//
// CONFIGURAÇÃO NECESSÁRIA NO NETLIFY:
// Site settings → Environment variables → adicionar:
//   MELHORENVIO_TOKEN      = (seu access_token)
//   MELHORENVIO_AMBIENTE   = sandbox    (ou "producao")
//
// Como ler:
//  - sandbox    → usa https://sandbox.melhorenvio.com.br
//  - producao   → usa https://melhorenvio.com.br

const CEP_ORIGEM = "13214101"; // 13.214-101 (Jundiaí/SP)
const ALTURA = 8;
const LARGURA = 13;
const COMPRIMENTO = 18; // você disse "altura 18", mas chamei de comprimento (3a dimensão)
const PESO_KG = 0.3;    // 300g

exports.handler = async function (event) {
  // CORS - permite chamadas só de qualquer origem (você pode restringir depois)
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { cepDestino, valorDeclarado } = JSON.parse(event.body || "{}");

    if (!cepDestino) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "CEP de destino é obrigatório" }),
      };
    }

    const cepLimpo = String(cepDestino).replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "CEP inválido. Use o formato 00000-000" }),
      };
    }

    const token = process.env.MELHORENVIO_TOKEN;
    if (!token) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Token do Melhor Envio não configurado no servidor",
        }),
      };
    }

    const ambiente = (process.env.MELHORENVIO_AMBIENTE || "sandbox").toLowerCase();
    const baseUrl =
      ambiente === "producao"
        ? "https://melhorenvio.com.br"
        : "https://sandbox.melhorenvio.com.br";

    const payload = {
      from: { postal_code: CEP_ORIGEM },
      to: { postal_code: cepLimpo },
      package: {
        height: ALTURA,
        width: LARGURA,
        length: COMPRIMENTO,
        weight: PESO_KG,
      },
      options: {
        receipt: false,
        own_hand: false,
        // valor declarado padrão = total do pedido (passado pelo front)
        insurance_value: Number(valorDeclarado) > 0 ? Number(valorDeclarado) : 0,
      },
      // 1 = PAC, 2 = SEDEX (Correios). Filtramos só esses dois.
      services: "1,2",
    };

    const resp = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Catalogo Pecas iPhone Premium ([email protected])",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({
          error: "Erro ao consultar Melhor Envio",
          status: resp.status,
          details: errTxt.slice(0, 500),
        }),
      };
    }

    const data = await resp.json();

    // A API retorna um array de serviços. Filtramos PAC e SEDEX e formatamos.
    const opcoes = (Array.isArray(data) ? data : [])
      .filter((s) => !s.error && s.price)
      .map((s) => ({
        id: s.id,
        nome: s.name,                  // "PAC" ou "SEDEX"
        preco: Number(s.price),
        prazo_dias: s.delivery_time,
        empresa: s.company ? s.company.name : "Correios",
      }))
      .filter((s) => ["PAC", "SEDEX"].includes(s.nome.toUpperCase()))
      .sort((a, b) => a.preco - b.preco);

    if (opcoes.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          opcoes: [],
          aviso: "Nenhum serviço PAC ou SEDEX disponível para este CEP.",
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ opcoes }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Erro interno: " + err.message }),
    };
  }
};
